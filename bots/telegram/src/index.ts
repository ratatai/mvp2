/**
 * RATATAI Telegram listing bot — entry point (long polling).
 *
 *   TELEGRAM_BOT_TOKEN=... VISION_PROVIDER=anthropic ANTHROPIC_API_KEY=... npm start
 *
 * See README.md for every setting.
 */

import { Conversation, newSession, type Messenger, type Session } from './conversation';
import { anthropicProvider, openAiCompatibleProvider } from './extraction/providers';
import type { VisionImage, VisionProvider } from './extraction/types';
import { langFromTelegram, t, type Lang } from './i18n';
import { TelegramClient, type TgMessage, type TgUpdate } from './telegram';

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name: string): string {
  const value = env(name);
  if (value === undefined) {
    console.error(`Missing ${name}. See bots/telegram/README.md.`);
    process.exit(1);
  }
  return value;
}

function visionFromEnv(): VisionProvider {
  const provider = env('VISION_PROVIDER') ?? 'anthropic';
  if (provider === 'anthropic') {
    return anthropicProvider({
      apiKey: requireEnv('ANTHROPIC_API_KEY'),
      model: env('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5',
    });
  }
  if (provider === 'openai_compatible') {
    const apiKey = env('OPENAI_COMPATIBLE_API_KEY');
    return openAiCompatibleProvider({
      baseUrl: requireEnv('OPENAI_COMPATIBLE_BASE_URL'),
      model: requireEnv('OPENAI_COMPATIBLE_MODEL'),
      ...(apiKey ? { apiKey } : {}),
    });
  }
  console.error(`Unknown VISION_PROVIDER "${provider}" (use anthropic or openai_compatible).`);
  process.exit(1);
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function mediaTypeFor(path: string): VisionImage['mediaType'] {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

/** The file id of the best photo in a message, if it carries one. */
function photoFileId(message: TgMessage): string | null {
  if (message.photo && message.photo.length > 0) {
    // Sizes come smallest → largest; take the largest that fits the limit.
    const fitting = message.photo.filter((size) => (size.file_size ?? 0) <= MAX_IMAGE_BYTES);
    const best = fitting[fitting.length - 1] ?? message.photo[0];
    return best?.file_id ?? null;
  }
  const doc = message.document;
  if (doc && /^image\/(jpeg|png|webp)$/.test(doc.mime_type ?? '') && (doc.file_size ?? 0) <= MAX_IMAGE_BYTES) {
    return doc.file_id;
  }
  return null;
}

async function main(): Promise<void> {
  const telegram = new TelegramClient(requireEnv('TELEGRAM_BOT_TOKEN'));
  const vision = visionFromEnv();
  const allowed = new Set(
    (env('ALLOWED_TELEGRAM_USER_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
  );

  // In-memory: a restart forgets unfinished drafts (nothing is lost on the site).
  const sessions = new Map<number, Session>();
  const queues = new Map<number, Promise<void>>();

  const loadPhoto = async (fileId: string): Promise<VisionImage> => {
    const file = await telegram.downloadFile(fileId);
    if (file.bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('photo too large');
    return { mediaType: mediaTypeFor(file.path), base64: Buffer.from(file.bytes).toString('base64') };
  };

  const conversationFor = (chatId: number, lang: Lang): Conversation => {
    let session = sessions.get(chatId);
    if (session === undefined) {
      session = newSession(lang);
      sessions.set(chatId, session);
    }
    const io: Messenger = {
      send: async (text, keyboard) => (await telegram.sendMessage(chatId, text, keyboard)).message_id,
      edit: (messageId, text, keyboard) => telegram.editMessage(chatId, messageId, text, keyboard),
      clearButtons: (messageId) => telegram.removeKeyboard(chatId, messageId),
    };
    return new Conversation(session, io, vision, loadPhoto, new Date().getFullYear());
  };

  const handle = async (update: TgUpdate): Promise<void> => {
    const message = update.message;
    const callback = update.callback_query;
    const user = message?.from ?? callback?.from;
    const chatId = message?.chat.id ?? callback?.message?.chat.id;
    if (user === undefined || chatId === undefined) return;
    if (message && message.chat.type !== 'private') return;

    const lang = sessions.get(chatId)?.lang ?? langFromTelegram(user.language_code);
    if (allowed.size > 0 && !allowed.has(String(user.id))) {
      if (callback) await telegram.answerCallback(callback.id);
      else await telegram.sendMessage(chatId, t(lang).notAllowed);
      return;
    }

    const conversation = conversationFor(chatId, lang);

    if (callback) {
      await telegram.answerCallback(callback.id);
      if (callback.data) await conversation.onButton(callback.data);
      return;
    }
    if (message === undefined) return;

    const text = message.text?.trim();
    if (text === '/start' || text === '/help') {
      await conversation.start();
      return;
    }
    if (text === '/lt' || text === '/ru') {
      conversation.session.lang = text === '/ru' ? 'ru' : 'lt';
      await telegram.sendMessage(chatId, t(conversation.session.lang).langSet);
      return;
    }
    if (text === '/new') {
      await conversation.onButton('restart');
      return;
    }
    const fileId = photoFileId(message);
    if (fileId !== null) {
      await conversation.onPhoto(fileId);
      return;
    }
    if (text) await conversation.onText(text);
  };

  /** Updates of one chat are handled strictly in order; chats run in parallel. */
  const enqueue = (update: TgUpdate): void => {
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id ?? 0;
    const previous = queues.get(chatId) ?? Promise.resolve();
    const next = previous
      .then(() => handle(update))
      .catch((error: unknown) => console.error('[update]', error instanceof Error ? error.message : error));
    queues.set(chatId, next);
  };

  console.log(`RATATAI listing bot started (vision: ${vision.name}).`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await telegram.getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        enqueue(update);
      }
    } catch (error) {
      console.error('[poll]', error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
}

void main();
