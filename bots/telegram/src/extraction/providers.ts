/**
 * Vision providers. Both talk plain HTTP with fetch — no SDKs — so the bot has
 * no runtime dependencies besides zod (shared with the site).
 *
 * - anthropic: Claude Messages API (paid, per request).
 * - openai_compatible: any OpenAI-style /chat/completions endpoint with image
 *   input, e.g. a self-hosted open-source model through Ollama or vLLM
 *   (free to run, needs your own server).
 */

import { coerceReadings, extractJsonObject } from './coerce';
import { REPORT_SCHEMA, SYSTEM_PROMPT, USER_INSTRUCTION } from './prompt';
import type { PhotoReadings, VisionImage, VisionProvider } from './types';

export class VisionError extends Error {}

const TIMEOUT_MS = 90_000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    // Never echo request headers (they hold the API key); the body is safe.
    throw new VisionError(`vision HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new VisionError('vision: response is not JSON');
  }
}

export function anthropicProvider(options: { apiKey: string; model: string }): VisionProvider {
  return {
    name: `anthropic:${options.model}`,
    async readPhotos(images: readonly VisionImage[]): Promise<PhotoReadings> {
      const content = [
        ...images.map((image) => ({
          type: 'image',
          source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
        })),
        { type: 'text', text: USER_INSTRUCTION },
      ];

      const data = (await postJson(
        'https://api.anthropic.com/v1/messages',
        { 'x-api-key': options.apiKey, 'anthropic-version': '2023-06-01' },
        {
          model: options.model,
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: 'report_tyre',
              description: 'Report what is legible on the tyre photos.',
              input_schema: REPORT_SCHEMA,
            },
          ],
          tool_choice: { type: 'tool', name: 'report_tyre' },
          messages: [{ role: 'user', content }],
        }
      )) as { content?: Array<{ type?: string; input?: unknown }> };

      const toolUse = data.content?.find((block) => block.type === 'tool_use');
      const readings = coerceReadings(toolUse?.input);
      if (readings === null) throw new VisionError('vision: no report in response');
      return readings;
    },
  };
}

export function openAiCompatibleProvider(options: {
  baseUrl: string;
  model: string;
  apiKey?: string;
}): VisionProvider {
  return {
    name: `openai_compatible:${options.model}`,
    async readPhotos(images: readonly VisionImage[]): Promise<PhotoReadings> {
      const content = [
        { type: 'text', text: `${USER_INSTRUCTION} Reply with JSON only, matching the schema.` },
        ...images.map((image) => ({
          type: 'image_url',
          image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
        })),
      ];

      const headers: Record<string, string> = {};
      if (options.apiKey) headers.authorization = `Bearer ${options.apiKey}`;

      const data = (await postJson(
        `${options.baseUrl.replace(/\/$/, '')}/chat/completions`,
        headers,
        {
          model: options.model,
          temperature: 0,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT.replace(
                'Call the report_tyre tool exactly once.',
                'Answer with one JSON object only.'
              ),
            },
            { role: 'user', content },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'report_tyre', schema: REPORT_SCHEMA },
          },
        }
      )) as { choices?: Array<{ message?: { content?: string } }> };

      const text = data.choices?.[0]?.message?.content ?? '';
      const readings = coerceReadings(extractJsonObject(text));
      if (readings === null) throw new VisionError('vision: no JSON in response');
      return readings;
    },
  };
}
