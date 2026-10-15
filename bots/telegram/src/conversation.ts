/**
 * One seller's conversation with the bot: collect photos → read them → ask
 * for whatever is missing or uncertain → show the result → hand out LT/RU
 * texts. Transport-agnostic: Telegram is plugged in through `Messenger`, so
 * the flow is unit-tested with a fake.
 */

import { buildDescription, buildTitle, displayValue, positionCard, toListingDraft } from './compose';
import { applyPatch, clearKeys, type DraftKey, type TyreDraft } from './draft';
import { normalizeReadings } from './extraction/normalize';
import type { VisionImage, VisionProvider } from './extraction/types';
import { SITE_DICT, t, type Lang } from './i18n';
import { buildQuestions, nextQuestion, suggestionFor, type Question, type QuestionId } from './questions';
import { describeFilter, parseQuery } from './search/query';
import type { SpeechToText } from './search/speech';
import type { Understanding } from './search/understand';
import { foldText, PAGE_SIZE, type Position, type PositionStore, type SearchFilter } from './store';
import type { InlineKeyboard } from './telegram';

export const MAX_PHOTOS = 10;

export interface Messenger {
  send(text: string, keyboard?: InlineKeyboard): Promise<number>;
  edit(messageId: number, text: string, keyboard?: InlineKeyboard): Promise<void>;
  clearButtons(messageId: number): Promise<void>;
  sendPhoto(fileId: string, caption: string, keyboard?: InlineKeyboard): Promise<number>;
  sendAlbum(fileIds: readonly string[]): Promise<void>;
}

export type PhotoLoader = (fileId: string) => Promise<VisionImage>;

export interface Services {
  readonly vision: VisionProvider | null;
  readonly loadPhoto: PhotoLoader;
  readonly store: PositionStore;
  readonly speech: SpeechToText | null;
  readonly understanding: Understanding | null;
  /** Telegram user id of the person talking to the bot. */
  readonly userId: number;
  /** Called after a position is saved (e.g. to back up its photos to disk). */
  readonly afterSave?: (id: number, photos: readonly string[]) => Promise<void>;
}

type Phase = 'collecting' | 'analysing' | 'asking' | 'summary' | 'done';

export interface Session {
  lang: Lang;
  phase: Phase;
  photos: string[];
  photoStatusId?: number;
  draft: TyreDraft;
  suggestions: Partial<TyreDraft>;
  settled: Set<QuestionId>;
  current?: { id: QuestionId; mode: 'confirm' | 'ask'; messageId: number };
  /** Remembered across listings so a shop does not retype its city. */
  lastCity?: string;
  /** The last search, for "more" paging. */
  lastSearch?: { filter: SearchFilter; page: number };
}

export function newSession(lang: Lang, lastCity?: string): Session {
  return {
    lang,
    phase: 'collecting',
    photos: [],
    draft: {},
    suggestions: {},
    settled: new Set(),
    ...(lastCity ? { lastCity } : {}),
  };
}

/** Starts a new listing but keeps what belongs to the person, not the listing. */
function resetListing(s: Session): void {
  const { lang, lastCity, lastSearch } = s;
  for (const key of Object.keys(s)) delete (s as unknown as Record<string, unknown>)[key];
  Object.assign(s, newSession(lang, lastCity), lastSearch ? { lastSearch } : {});
}

/** Fields that only make sense together with another one. */
const DEPENDENTS: Partial<Record<QuestionId, readonly DraftKey[]>> = {
  dot: ['manufacturing_year'],
  quantity: ['sale_unit'],
  season: ['studded'],
};

export class Conversation {
  private readonly questions: readonly Question[];

  constructor(
    readonly session: Session,
    private readonly io: Messenger,
    private readonly services: Services,
    private readonly currentYear: number
  ) {
    this.questions = buildQuestions(currentYear);
  }

  private get tx() {
    return t(this.session.lang);
  }

  /* ------------------------------------------------------------------ */
  /* Entry points                                                        */
  /* ------------------------------------------------------------------ */

  async start(): Promise<void> {
    await this.io.send(`${this.tx.welcome}\n\n${this.tx.tips}\n\n${this.tx.search}`);
  }

  async onPhoto(fileId: string): Promise<void> {
    const s = this.session;
    if (s.phase !== 'collecting') {
      // New photos after a listing (or mid-way) start a fresh listing.
      resetListing(s);
    }
    if (s.photos.length >= MAX_PHOTOS) {
      await this.io.send(this.tx.tooManyPhotos);
      return;
    }
    s.photos.push(fileId);
    const text = this.tx.photoReceived(s.photos.length);
    const keyboard: InlineKeyboard = [[{ text: this.tx.analyse, callback_data: 'analyse' }]];
    if (s.photoStatusId === undefined) {
      s.photoStatusId = await this.io.send(text, keyboard);
    } else {
      await this.io.edit(s.photoStatusId, text, keyboard);
    }
  }

  /** Text is an answer while a question is open; otherwise it is a stock search. */
  async onText(text: string): Promise<void> {
    const s = this.session;
    if (s.phase !== 'asking' || s.current === undefined) {
      await this.search(text, false);
      return;
    }

    const q = this.question(s.current.id);
    if (q.parse === undefined) {
      await this.io.send(this.tx.useText);
      return;
    }
    const patch = q.parse(text, s.draft);
    if (patch === null) {
      await this.io.send(this.tx.invalid);
      return;
    }
    await this.io.clearButtons(s.current.messageId);
    this.answer(q, patch);
    await this.askNext();
  }

  /** Voice: an answer while a question is open; otherwise a stock search. */
  async onVoice(audio: Uint8Array): Promise<void> {
    const s = this.session;
    if (this.services.speech === null) {
      await this.io.send(this.tx.voiceOff);
      return;
    }
    let transcript: string;
    try {
      transcript = await this.services.speech.transcribe(
        audio,
        'voice.ogg',
        s.lang,
        this.services.store.knownBrands()
      );
    } catch (error) {
      console.error('[speech]', error instanceof Error ? error.message : error);
      await this.io.send(this.tx.voiceFailed);
      return;
    }
    if (transcript.length === 0) {
      await this.io.send(this.tx.voiceFailed);
      return;
    }
    await this.io.send(this.tx.heard(transcript));

    if (s.phase === 'asking' && s.current !== undefined) {
      await this.voiceAnswer(this.question(s.current.id), transcript);
      return;
    }
    await this.search(transcript, true);
  }

  async onButton(data: string): Promise<void> {
    const s = this.session;

    // Stock actions work at any point of the conversation.
    if (data === 'more') return this.showMore();
    const stock = /^(ph|sold|act|del|delok):(\d+)$/.exec(data);
    if (stock) return this.stockAction(stock[1] ?? '', Number(stock[2]));

    if (data === 'analyse') {
      if (s.phase === 'collecting') await this.analyse();
      return;
    }
    if (data === 'restart') {
      resetListing(s);
      await this.io.send(this.tx.restarted);
      return;
    }
    if (s.phase === 'summary') {
      if (data === 'done') return this.finish();
      if (data === 'edit') return this.showEditMenu();
      if (data.startsWith('e:')) return this.reopen(data.slice(2) as QuestionId);
      return;
    }
    if (s.phase !== 'asking' || s.current === undefined) return;

    const q = this.question(s.current.id);
    const messageId = s.current.messageId;

    if (data === 'y' && s.current.mode === 'confirm') {
      const patch = suggestionFor(q, s.suggestions);
      if (patch !== null) this.answer(q, patch);
    } else if (data === 'n' && s.current.mode === 'confirm') {
      this.dropSuggestion(q);
    } else if (data === 'skip' && !q.required) {
      s.settled.add(q.id);
    } else if (data.startsWith('c:')) {
      const choice = this.choicesFor(q)[Number(data.slice(2))];
      if (choice === undefined) return;
      if (choice.patch === null) s.settled.add(q.id);
      else this.answer(q, choice.patch);
    } else {
      return;
    }
    await this.io.clearButtons(messageId);
    await this.askNext();
  }

  /* ------------------------------------------------------------------ */
  /* Steps                                                               */
  /* ------------------------------------------------------------------ */

  private async analyse(): Promise<void> {
    const s = this.session;
    if (s.photos.length === 0) {
      await this.io.send(this.tx.noPhotos);
      return;
    }
    s.phase = 'analysing';
    if (s.photoStatusId !== undefined) await this.io.edit(s.photoStatusId, this.tx.analysing);

    let summaryLines: string[] = [];
    try {
      const { vision, loadPhoto } = this.services;
      if (vision === null) throw new Error('no vision provider');
      const images = await Promise.all(s.photos.map((id) => loadPhoto(id)));
      const readings = await vision.readPhotos(images);
      const result = normalizeReadings(readings, this.currentYear);
      if (result.notTyres) {
        resetListing(s);
        await this.io.send(this.tx.notTyres);
        return;
      }
      if (result.mixedTyres) await this.io.send(this.tx.mixedTyres);
      s.draft = applyPatch(s.draft, result.accepted);
      s.suggestions = result.suggestions;
      summaryLines = this.describe(s.draft);
      await this.io.send(
        summaryLines.length > 0 ? `${this.tx.readFromPhotos}\n${summaryLines.join('\n')}` : this.tx.foundNothing
      );
    } catch (error) {
      console.error('[vision]', error instanceof Error ? error.message : error);
      await this.io.send(this.tx.visionFailed);
    }
    s.phase = 'asking';
    await this.askNext();
  }

  private async askNext(): Promise<void> {
    const s = this.session;
    const q = nextQuestion(this.questions, s.draft, s.settled);
    if (q === null) {
      s.current = undefined;
      await this.showSummary();
      return;
    }

    const suggestion = suggestionFor(q, s.suggestions);
    if (suggestion !== null) {
      const label = this.label(q);
      const value = displayValue(q.keys[0] as DraftKey, suggestion, s.lang) ?? '';
      const messageId = await this.io.send(this.tx.confirm(label, value), [
        [
          { text: this.tx.yes, callback_data: 'y' },
          { text: this.tx.no, callback_data: 'n' },
        ],
      ]);
      s.current = { id: q.id, mode: 'confirm', messageId };
      return;
    }

    const rows: { text: string; callback_data: string }[][] = [];
    const choices = this.choicesFor(q);
    if (choices.length > 0) {
      rows.push(choices.map((choice, index) => ({ text: choice.label, callback_data: `c:${index}` })));
    }
    if (!q.required) rows.push([{ text: this.tx.skip, callback_data: 'skip' }]);
    const messageId = await this.io.send(q.prompt(s.lang), rows.length > 0 ? rows : undefined);
    s.current = { id: q.id, mode: 'ask', messageId };
  }

  private async showSummary(): Promise<void> {
    const s = this.session;
    s.phase = 'summary';
    const lines = this.describe(s.draft);
    const text = [
      this.tx.summary,
      '',
      ...lines,
      '',
      `🇱🇹 ${buildTitle(s.draft, 'lt')}`,
      `🇷🇺 ${buildTitle(s.draft, 'ru')}`,
    ].join('\n');
    await this.io.send(text, [
      [
        { text: this.tx.done, callback_data: 'done' },
        { text: this.tx.edit, callback_data: 'edit' },
      ],
      [{ text: this.tx.restart, callback_data: 'restart' }],
    ]);
  }

  private async showEditMenu(): Promise<void> {
    const relevant = this.questions.filter((q) => q.relevant(this.session.draft));
    const rows: { text: string; callback_data: string }[][] = [];
    for (let i = 0; i < relevant.length; i += 2) {
      rows.push(
        relevant.slice(i, i + 2).map((q) => ({ text: this.label(q), callback_data: `e:${q.id}` }))
      );
    }
    await this.io.send(this.tx.chooseEdit, rows);
  }

  private async reopen(id: QuestionId): Promise<void> {
    const s = this.session;
    const q = this.questions.find((item) => item.id === id);
    if (q === undefined) return;
    const keys = [...q.keys, ...(DEPENDENTS[id] ?? [])];
    s.draft = clearKeys(s.draft, keys);
    s.suggestions = clearKeys(s.suggestions as TyreDraft, keys);
    s.settled.delete(id);
    for (const [qid, deps] of Object.entries(DEPENDENTS)) {
      // Re-ask a dependent question too (e.g. sale unit after a new quantity).
      if (qid === id) {
        for (const other of this.questions) {
          if (other.keys.some((key) => deps.includes(key))) s.settled.delete(other.id);
        }
      }
    }
    s.phase = 'asking';
    await this.askNext();
  }

  private async finish(): Promise<void> {
    const s = this.session;
    const result = toListingDraft(s.draft);
    if (!result.ok) {
      await this.io.send(`${this.tx.invalidDraft}\n${result.issues.join('\n')}`);
      await this.showEditMenu();
      return;
    }
    s.phase = 'done';
    if (s.draft.city) s.lastCity = s.draft.city;

    const texts = {
      titleLt: buildTitle(s.draft, 'lt'),
      titleRu: buildTitle(s.draft, 'ru'),
      descriptionLt: buildDescription(s.draft, 'lt'),
      descriptionRu: buildDescription(s.draft, 'ru'),
    };
    const id = this.services.store.add({
      draft: s.draft,
      ...texts,
      photos: [...s.photos],
      createdBy: this.services.userId,
    });
    if (this.services.afterSave) {
      // A failed backup must not lose the saved position.
      await this.services.afterSave(id, [...s.photos]).catch((error: unknown) =>
        console.error('[backup]', error instanceof Error ? error.message : error)
      );
    }

    await this.io.send(`${this.tx.saved(id)}\n${this.tx.final}`);
    await this.io.send(`${this.tx.textLt}\n\n${texts.titleLt}\n\n${texts.descriptionLt}`);
    await this.io.send(`${this.tx.textRu}\n\n${texts.titleRu}\n\n${texts.descriptionRu}`);
  }

  /* ------------------------------------------------------------------ */
  /* Voice answers                                                       */
  /* ------------------------------------------------------------------ */

  private async voiceAnswer(q: Question, transcript: string): Promise<void> {
    const s = this.session;
    const said = foldText(transcript);
    const current = s.current;
    if (current === undefined) return;

    // "Taip / Да" on a confirmation, or a choice said out loud.
    if (current.mode === 'confirm') {
      if (/^(taip|tinka|teisingai|да|верно|правильно|yes)\b/.test(said)) return this.onButton('y');
      if (/^(ne|нет|no)\b/.test(said)) return this.onButton('n');
    }
    const choices = this.choicesFor(q);
    const choiceIndex = choices.findIndex((choice) => {
      const label = foldText(choice.label);
      return said === label || said.startsWith(label) || (label.length >= 4 && said.startsWith(label.slice(0, 4)));
    });
    if (choiceIndex !== -1) return this.onButton(`c:${choiceIndex}`);
    if (!q.required && this.tx.skipWords.some((word) => said === foldText(word))) return this.onButton('skip');

    if (q.parse === undefined) {
      await this.io.send(this.tx.useText);
      return;
    }
    let patch = q.parse(transcript, s.draft);
    if (patch === null && this.services.understanding !== null) {
      try {
        const written = await this.services.understanding.normaliseAnswer(q.prompt(s.lang), transcript);
        patch = q.parse(written, s.draft);
      } catch (error) {
        console.error('[understand]', error instanceof Error ? error.message : error);
      }
    }
    if (patch === null) {
      await this.io.send(this.tx.invalid);
      return;
    }
    await this.io.clearButtons(current.messageId);
    this.answer(q, patch);
    await this.askNext();
  }

  /* ------------------------------------------------------------------ */
  /* Stock search                                                        */
  /* ------------------------------------------------------------------ */

  async search(phrase: string, spoken: boolean): Promise<void> {
    const { store, understanding } = this.services;
    const brands = store.knownBrands();
    const parsed = parseQuery(phrase, brands);
    let filter: SearchFilter = parsed.filter;

    // Spoken phrases, or typed ones with words the plain parser did not get,
    // go to the language model; its answer is range-checked.
    if (understanding !== null && filter.id === undefined && (spoken || parsed.leftover.length > 0)) {
      try {
        const understood = await understanding.toFilter(phrase, brands);
        if (Object.keys(understood).length > 0) filter = understood;
      } catch (error) {
        console.error('[understand]', error instanceof Error ? error.message : error);
      }
    }
    await this.runSearch(filter, 0);
  }

  async showAll(): Promise<void> {
    await this.runSearch({}, 0);
  }

  private async runSearch(filter: SearchFilter, page: number): Promise<void> {
    const { store } = this.services;
    let result = store.search(filter, page);
    let used = filter;

    // Free words that match nothing should not hide real matches by size/season.
    if (page === 0 && result.total === 0 && filter.text && Object.keys(filter).length > 1) {
      const { text, ...rest } = filter;
      const relaxed = store.search(rest, 0);
      if (relaxed.total > 0) {
        await this.io.send(this.tx.relaxed(text));
        result = relaxed;
        used = rest;
      }
    }
    this.session.lastSearch = { filter: used, page };

    if (page === 0) {
      await this.io.send(
        result.total === 0
          ? `${this.tx.found(describeFilter(used, this.session.lang), 0)}\n${this.tx.nothingFound}`
          : this.tx.found(describeFilter(used, this.session.lang), result.total)
      );
    }
    for (const position of result.items) await this.sendCard(position);

    if ((page + 1) * PAGE_SIZE < result.total) {
      await this.io.send(`${(page + 1) * PAGE_SIZE} / ${result.total}`, [[{ text: this.tx.more, callback_data: 'more' }]]);
    }
  }

  private async showMore(): Promise<void> {
    const last = this.session.lastSearch;
    if (last === undefined) return;
    await this.runSearch(last.filter, last.page + 1);
  }

  private cardKeyboard(p: Position): InlineKeyboard {
    const rows: { text: string; callback_data: string }[][] = [];
    if (p.photos.length > 1) rows.push([{ text: this.tx.allPhotos(p.photos.length), callback_data: `ph:${p.id}` }]);
    rows.push([
      p.status === 'active'
        ? { text: this.tx.markSold, callback_data: `sold:${p.id}` }
        : { text: this.tx.markActive, callback_data: `act:${p.id}` },
      { text: this.tx.remove, callback_data: `del:${p.id}` },
    ]);
    return rows;
  }

  private async sendCard(p: Position): Promise<void> {
    const caption = positionCard(p, this.session.lang, this.tx.soldMark);
    const first = p.photos[0];
    if (first === undefined) await this.io.send(caption, this.cardKeyboard(p));
    else await this.io.sendPhoto(first, caption, this.cardKeyboard(p));
  }

  private async stockAction(action: string, id: number): Promise<void> {
    const { store } = this.services;
    const p = store.get(id);
    if (p === null) {
      await this.io.send(this.tx.notFound);
      return;
    }
    switch (action) {
      case 'ph':
        await this.io.sendAlbum(p.photos);
        return;
      case 'sold':
        store.setStatus(id, 'sold');
        await this.io.send(this.tx.statusSold(id), [[{ text: this.tx.markActive, callback_data: `act:${id}` }]]);
        return;
      case 'act':
        store.setStatus(id, 'active');
        await this.io.send(this.tx.statusActive(id));
        return;
      case 'del':
        await this.io.send(this.tx.confirmDelete(id), [[{ text: this.tx.deleteYes, callback_data: `delok:${id}` }]]);
        return;
      case 'delok':
        store.delete(id);
        await this.io.send(this.tx.deleted(id));
        return;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  private question(id: QuestionId): Question {
    const q = this.questions.find((item) => item.id === id);
    if (q === undefined) throw new Error(`unknown question ${id}`);
    return q;
  }

  private choicesFor(q: Question) {
    const base = q.choices?.(this.session.lang, this.session.draft) ?? [];
    if (q.id === 'city' && this.session.lastCity) {
      return [{ label: this.session.lastCity, patch: { city: this.session.lastCity } }, ...base];
    }
    return base;
  }

  private answer(q: Question, patch: Partial<TyreDraft>): void {
    const s = this.session;
    s.draft = applyPatch(s.draft, patch);
    s.settled.add(q.id);
    this.dropSuggestion(q);
  }

  private dropSuggestion(q: Question): void {
    const keys = [...q.keys, ...(q.id === 'dot' ? (['manufacturing_year'] as const) : [])];
    this.session.suggestions = clearKeys(this.session.suggestions as TyreDraft, keys);
  }

  private label(q: Question): string {
    const specs = SITE_DICT[this.session.lang].specs;
    switch (q.id) {
      case 'size':
        return specs.size;
      case 'load_speed':
        return `${specs.load_index} / ${specs.speed_index}`;
      case 'quantity':
        return this.session.lang === 'lt' ? 'Kiekis' : 'Количество';
      case 'price':
        return this.session.lang === 'lt' ? 'Kaina' : 'Цена';
      case 'city':
        return this.session.lang === 'lt' ? 'Miestas' : 'Город';
      default:
        return specs[q.id as keyof typeof specs] ?? q.id;
    }
  }

  /** "Label: value" lines for every filled question, in question order. */
  private describe(d: TyreDraft): string[] {
    const lines: string[] = [];
    for (const q of this.questions) {
      const value = displayValue(q.keys[0] as DraftKey, d, this.session.lang);
      if (value !== null) lines.push(`• ${this.label(q)}: ${value}`);
    }
    return lines;
  }
}
