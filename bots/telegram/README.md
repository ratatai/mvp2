# RATATAI Telegram listing bot

A Telegram bot for the RATATAI team: it turns tyre photos into a ready
listing, keeps every finished position with its photos in a stock database,
and finds positions by text or voice.

1. The seller sends 1–10 photos (sidewall with the markings, tread, DOT code).
2. A vision model reads what is legible: brand, model, size, load/speed index,
   season, DOT (→ manufacturing year), XL, Run Flat, studs, tread depth (only
   from a gauge on the photo), visible damage, how many tyres are shown.
3. Values read with certainty go straight into the draft. Doubtful ones are
   shown to the seller to confirm. Anything missing is asked — required fields
   first, optional ones with a "don't know" button.
4. The seller checks a summary, can fix any field, and gets the listing text
   in **Lithuanian and Russian**, ready to copy.
5. The position is saved to the stock with its photos (`#12`). Questions can
   also be answered by voice.

## Stock search

Any text or voice message that is not an answer to a question is a search:

- `205/55 R16 žieminės Nokian`, `225 45 17`, `R16 dygliuotos iki 200`,
  `зимние шипы 16 радиус до 200 евро`, `б/у комплект липучка`, `#12`, `/all`.
- The bot first replies with what it understood (`🔎 205/55 R16 · žieminės —
  rasta: 3`), then one card per position: first photo, title, quantity, price,
  tread, year, damage; buttons for all photos, **sold / back to sale**, delete
  (with confirmation). Sold positions are hidden from searches but stay in
  the database (`#12` still finds them). Five results per page, then "more".
- Typed phrases are parsed by plain code. Voice messages are transcribed
  (OpenAI speech-to-text, with a hint listing tyre terms and the team's
  brands), then a language model turns the spoken phrase ("двести пять
  пятьдесят пять шестнадцать") into a filter. Every value it returns is
  range-checked, and if the model is down the plain parser is used.
- Free words that match nothing ("raudonos") are dropped with a note instead
  of hiding real matches by size/season.

## Data

- `DATABASE_PATH` (default `./data/ratatai-bot.sqlite`): the stock, in one
  SQLite file (Node's built-in `node:sqlite`, no extra dependency).
- Photos are kept as Telegram file ids (the bot can resend them any time) and,
  when `PHOTO_DIR` is set, also downloaded to `PHOTO_DIR/<id>/`.
- Run the bot on a server with a persistent disk and back up the `data/`
  folder. This database is the bot's own; it is not the site's Supabase.

The bot lives **outside the site** — it does not add AI features to RATATAI
and never touches the site's database. The final draft is validated with the site's
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
| `ALLOWED_TELEGRAM_USER_IDS` | yes | Comma-separated ids of the team. Anyone else is refused and told their id, so you can add them |
| `VISION_PROVIDER` | no | `anthropic` (default) or `openai_compatible` |
| `ANTHROPIC_API_KEY` | for `anthropic` | Claude API key (paid per use) |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-5-5` |
| `OPENAI_COMPATIBLE_BASE_URL` | for `openai_compatible` | e.g. `http://localhost:11434/v1` (Ollama) |
| `OPENAI_COMPATIBLE_MODEL` | for `openai_compatible` | A vision model, e.g. `qwen2.5vl:7b` |
| `OPENAI_COMPATIBLE_API_KEY` | no | If the endpoint needs one |
| `UNDERSTANDING_MODEL` | no | Model for spoken/free-form searches, default `claude-haiku-5-5` (uses `ANTHROPIC_API_KEY`) |
| `OPENAI_API_KEY` | for voice | Speech-to-text; without it voice messages are refused politely |
| `SPEECH_MODEL` | no | Default `gpt-4o-transcribe` |
| `DATABASE_PATH` | no | Default `./data/ratatai-bot.sqlite` |
| `PHOTO_DIR` | no | Folder for photo backups, e.g. `./data/photos` |

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

Commands in Telegram: `/start`, `/new` (start over), `/all` (whole stock), `/lt`, `/ru`.

Node 22.13+ is required (`node:sqlite`); Node prints an "experimental"
warning for it on start — harmless. Unfinished drafts are kept in memory;
saved positions are in the database.

## Checks

```bash
npm test         # parsing, normalisation, texts, stock search, voice flow, full conversation with a fake chat
npm run typecheck
```
