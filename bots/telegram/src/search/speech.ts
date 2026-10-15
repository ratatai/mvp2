/**
 * Voice → text with OpenAI's transcription endpoint (multipart upload of the
 * Telegram OGG/Opus voice note). A vocabulary hint with tyre terms and the
 * team's brands makes numbers and brand names come out right far more often.
 */

import type { Lang } from '../i18n';

export interface SpeechToText {
  transcribe(audio: Uint8Array, filename: string, lang: Lang, vocabulary: readonly string[]): Promise<string>;
}

const BASE_HINT = {
  lt: 'Padangos: 205/55 R16, 225/45 R17, vasarinės, žieminės, visasezonės, dygliuotos, protektorius, DOT.',
  ru: 'Шины: 205/55 R16, 225/45 R17, летние, зимние, всесезонные, шипованные, протектор, радиус, DOT.',
} as const;

export function openAiSpeech(options: { apiKey: string; model: string }): SpeechToText {
  return {
    async transcribe(audio, filename, lang, vocabulary) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }), filename);
      form.append('model', options.model);
      form.append('language', lang);
      form.append('prompt', `${BASE_HINT[lang]} ${vocabulary.slice(0, 60).join(', ')}`);
      form.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { authorization: `Bearer ${options.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`speech HTTP ${response.status}: ${body.slice(0, 300)}`);
      const text = (JSON.parse(body) as { text?: unknown }).text;
      if (typeof text !== 'string') throw new Error('speech: no text');
      return text.trim();
    },
  };
}
