# RATATAI Telegram listing bot

A Telegram bot that turns tyre photos into a ready listing.

1. The seller sends 1–10 photos (sidewall with the markings, tread, DOT code).
2. A vision model reads what is legible: brand, model, size, load/speed index,
   season, DOT (→ manufacturing year), XL, Run Flat, studs, tread depth (only
   from a gauge on the photo), visible damage, how many tyres are shown.
3. Values read with certainty go straight into the draft. Doubtful ones are
   shown to the seller to confirm. Anything missing is asked — required fields
   first, optional ones with a "don't know" button.
4. The seller checks a summary, can fix any field, and gets the listing text
   in **Lithuanian and Russian**, ready to copy.

The bot lives **outside the site** — it does not add AI features to RATATAI
and never touches the database. The final draft is validated with the site's
own schema (`src/domain/listing.validation.ts`), so everything it produces can
be entered into the site's form unchanged. Tyres (`padangos`) only for now.

## How it decides

- The model only reports raw readings ("205/55 R16", "91V", "DOT EX2B 4521")
  with a confidence. Converting them to fields is plain code (`src/parse.ts`,
  `src/extraction/normalize.ts`) using the same ranges as the site, so a model
  mistake cannot produce an invalid value.
- The manufacturing year is computed from the DOT date code (WWYY), never
  taken from the model, and never in the future.
- Condition, damage and quantity are always confirmed by the seller.
- Listing texts are built from templates (`src/compose.ts`): every sentence
  states a value the seller confirmed; nothing is invented.

## Settings

| Variable | Required | Meaning |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | Token from @BotFather |
| `VISION_PROVIDER` | no | `anthropic` (default) or `openai_compatible` |
| `ANTHROPIC_API_KEY` | for `anthropic` | Claude API key (paid per use) |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-5-5` |
| `OPENAI_COMPATIBLE_BASE_URL` | for `openai_compatible` | e.g. `http://localhost:11434/v1` (Ollama) |
| `OPENAI_COMPATIBLE_MODEL` | for `openai_compatible` | A vision model, e.g. `qwen2.5vl:7b` |
| `OPENAI_COMPATIBLE_API_KEY` | no | If the endpoint needs one |
| `ALLOWED_TELEGRAM_USER_IDS` | no | Comma-separated user ids; empty = anyone |

`openai_compatible` lets you run a free open-source vision model on your own
server (Ollama, vLLM) instead of a paid API. Small local models read sidewall
text less reliably; the bot then simply asks more questions.

## Run

```bash
# from the repository root (the bot reuses the site's zod schemas)
npm ci
cd bots/telegram
npm install
cp .env.example .env   # fill in the values, never commit .env
set -a && . ./.env && set +a
npm start
```

Commands in Telegram: `/start`, `/new` (start over), `/lt`, `/ru`.

Drafts are kept in memory: restarting the bot forgets unfinished drafts.

## Checks

```bash
npm test         # parsing, normalisation, texts, full conversation with a fake chat
npm run typecheck
```
