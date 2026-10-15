/**
 * One seller's conversation with the bot: collect photos → read them → ask
 * for whatever is missing or uncertain → show the result → hand out LT/RU
 * texts. Transport-agnostic: Telegram is plugged in through `Messenger`, so
 * the flow is unit-tested with a fake.
 */

import { buildDescription, buildTitle, displayValue, toListingDraft } from './compose';
import { applyPatch, clearKeys, type DraftKey, type TyreDraft } from './draft';
import { normalizeReadings } from './extraction/normalize';
import type { VisionImage, VisionProvider } from './extraction/types';
import { SITE_DICT, t, type Lang } from './i18n';
import { buildQuestions, nextQuestion, suggestionFor, type Question, type QuestionId } from './questions';
import type { InlineKeyboard } from './telegram';

export const MAX_PHOTOS = 10;

export interface Messenger {
  send(text: string, keyboard?: InlineKeyboard): Promise<number>;
  edit(messageId: number, text: string, keyboard?: InlineKeyboard): Promise<void>;
  clearButtons(messageId: number): Promise<void>;
}

export type PhotoLoader = (fileId: string) => Promise<VisionImage>;

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
    private readonly vision: VisionProvider | null,
    private readonly loadPhoto: PhotoLoader,
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
    await this.io.send(`${this.tx.welcome}\n\n${this.tx.tips}`);
  }

  async onPhoto(fileId: string): Promise<void> {
    const s = this.session;
    if (s.phase !== 'collecting') {
      // New photos after a listing (or mid-way) start a fresh listing.
      Object.assign(s, newSession(s.lang, s.lastCity));
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

  async onText(text: string): Promise<void> {
    const s = this.session;
    if (s.phase === 'collecting') {
      await this.io.send(s.photos.length === 0 ? this.tx.noPhotos : this.tx.photoReceived(s.photos.length));
      return;
    }
    if (s.phase === 'done') {
      await this.io.send(this.tx.welcome);
      return;
    }
    if (s.phase !== 'asking' || s.current === undefined) return;

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

  async onButton(data: string): Promise<void> {
    const s = this.session;

    if (data === 'analyse') {
      if (s.phase === 'collecting') await this.analyse();
      return;
    }
    if (data === 'restart') {
      Object.assign(s, newSession(s.lang, s.lastCity));
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
      if (this.vision === null) throw new Error('no vision provider');
      const images = await Promise.all(s.photos.map((id) => this.loadPhoto(id)));
      const readings = await this.vision.readPhotos(images);
      const result = normalizeReadings(readings, this.currentYear);
      if (result.notTyres) {
        Object.assign(s, newSession(s.lang, s.lastCity));
        await this.io.send(this.tx.notTyres);
        return;
      }
      if (result.mixedTyres) await this.io.send(this.tx.mixedTyres);
      s.draft = applyPatch(s.draft, result.accepted);
      s.suggestions = result.suggestions;
      summaryLines = this.describe(s.draft);
      await this.io.send(
        summaryLines.length > 0 ? `${this.tx.found}\n${summaryLines.join('\n')}` : this.tx.foundNothing
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
    await this.io.send(this.tx.final);
    await this.io.send(`${this.tx.textLt}\n\n${buildTitle(s.draft, 'lt')}\n\n${buildDescription(s.draft, 'lt')}`);
    await this.io.send(`${this.tx.textRu}\n\n${buildTitle(s.draft, 'ru')}\n\n${buildDescription(s.draft, 'ru')}`);
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
