/**
 * Minimal Telegram Bot API client over fetch (long polling, no webhooks, no
 * SDK). Only the methods the bot uses.
 */

export interface TgUser {
  readonly id: number;
  readonly language_code?: string;
}

export interface TgPhotoSize {
  readonly file_id: string;
  readonly width: number;
  readonly height: number;
  readonly file_size?: number;
}

export interface TgMessage {
  readonly message_id: number;
  readonly chat: { readonly id: number; readonly type: string };
  readonly from?: TgUser;
  readonly text?: string;
  readonly photo?: readonly TgPhotoSize[];
  readonly document?: { readonly file_id: string; readonly mime_type?: string; readonly file_size?: number };
  readonly media_group_id?: string;
}

export interface TgCallbackQuery {
  readonly id: string;
  readonly from: TgUser;
  readonly data?: string;
  readonly message?: TgMessage;
}

export interface TgUpdate {
  readonly update_id: number;
  readonly message?: TgMessage;
  readonly callback_query?: TgCallbackQuery;
}

export interface InlineButton {
  readonly text: string;
  readonly callback_data: string;
}

export type InlineKeyboard = readonly (readonly InlineButton[])[];

export class TelegramClient {
  private readonly base: string;
  private readonly fileBase: string;

  constructor(token: string) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.fileBase = `https://api.telegram.org/file/bot${token}`;
  }

  private async call<T>(method: string, body: Record<string, unknown>, timeoutMs = 30_000): Promise<T> {
    const response = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = (await response.json()) as { ok: boolean; result?: T; description?: string };
    // The URL contains the token, so errors only report the method name.
    if (!data.ok) throw new Error(`telegram ${method}: ${data.description ?? response.status}`);
    return data.result as T;
  }

  getUpdates(offset: number): Promise<TgUpdate[]> {
    return this.call<TgUpdate[]>(
      'getUpdates',
      { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] },
      60_000
    );
  }

  sendMessage(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<TgMessage> {
    return this.call<TgMessage>('sendMessage', {
      chat_id: chatId,
      text,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    });
  }

  async editMessage(chatId: number, messageId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
    try {
      await this.call('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        reply_markup: { inline_keyboard: keyboard ?? [] },
      });
    } catch (error) {
      // "message is not modified" is harmless.
      if (!String(error).includes('not modified')) throw error;
    }
  }

  async removeKeyboard(chatId: number, messageId: number): Promise<void> {
    try {
      await this.call('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    } catch {
      // Old or already-edited message: nothing to do.
    }
  }

  async answerCallback(id: string, text?: string): Promise<void> {
    try {
      await this.call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
    } catch {
      // Expired callbacks cannot be answered; ignore.
    }
  }

  /** Downloads a file Telegram holds (photos are at most 20 MB via the Bot API). */
  async downloadFile(fileId: string): Promise<{ bytes: Uint8Array; path: string }> {
    const file = await this.call<{ file_path?: string }>('getFile', { file_id: fileId });
    if (!file.file_path) throw new Error('telegram getFile: no file_path');
    const response = await fetch(`${this.fileBase}/${file.file_path}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`telegram download: HTTP ${response.status}`);
    return { bytes: new Uint8Array(await response.arrayBuffer()), path: file.file_path };
  }
}
