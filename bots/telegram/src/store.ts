/**
 * The team's stock of positions, kept by the bot in a local SQLite file
 * (Node's built-in node:sqlite — no extra dependency, one file to back up).
 *
 * Photos are stored as Telegram file ids (the bot can resend them at any time)
 * and, when PHOTO_DIR is set, also downloaded to disk as a backup.
 *
 * This is the bot's own database; it never writes to the site's Supabase.
 */

import { DatabaseSync } from 'node:sqlite';

import type { TyreDraft } from './draft';

export type PositionStatus = 'active' | 'sold';

export interface Position {
  readonly id: number;
  readonly status: PositionStatus;
  readonly draft: TyreDraft;
  readonly titleLt: string;
  readonly titleRu: string;
  readonly descriptionLt: string;
  readonly descriptionRu: string;
  readonly photos: readonly string[];
  readonly createdBy: number;
  readonly createdAt: string;
}

export interface NewPosition {
  readonly draft: TyreDraft;
  readonly titleLt: string;
  readonly titleRu: string;
  readonly descriptionLt: string;
  readonly descriptionRu: string;
  readonly photos: readonly string[];
  readonly createdBy: number;
}

/** A structured search. Every field is optional; empty = everything active. */
export interface SearchFilter {
  id?: number;
  width?: number;
  aspect_ratio?: number;
  diameter?: number;
  season?: 'summer' | 'winter' | 'all_season';
  brand?: string;
  model?: string;
  studded?: boolean;
  condition?: 'new' | 'used';
  min_quantity?: number;
  max_price?: number;
  /** Free words matched against brand, model, titles and defects. */
  text?: string;
  include_sold?: boolean;
}

export const PAGE_SIZE = 5;

interface Row {
  id: number;
  status: PositionStatus;
  draft_json: string;
  title_lt: string;
  title_ru: string;
  description_lt: string;
  description_ru: string;
  photos_json: string;
  created_by: number;
  created_at: string;
}

function toPosition(row: Row): Position {
  return {
    id: row.id,
    status: row.status,
    draft: JSON.parse(row.draft_json) as TyreDraft,
    titleLt: row.title_lt,
    titleRu: row.title_ru,
    descriptionLt: row.description_lt,
    descriptionRu: row.description_ru,
    photos: JSON.parse(row.photos_json) as string[],
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/** Lower-case and strip Lithuanian/Russian diacritics-insensitive noise for matching. */
export function foldText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export class PositionStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS positions (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold')),
        brand          TEXT,
        model          TEXT,
        width          INTEGER,
        aspect_ratio   INTEGER,
        diameter       INTEGER,
        season         TEXT,
        studded        INTEGER,
        condition      TEXT,
        quantity       INTEGER,
        price          REAL,
        search_text    TEXT    NOT NULL,
        draft_json     TEXT    NOT NULL,
        title_lt       TEXT    NOT NULL,
        title_ru       TEXT    NOT NULL,
        description_lt TEXT    NOT NULL,
        description_ru TEXT    NOT NULL,
        photos_json    TEXT    NOT NULL,
        created_by     INTEGER NOT NULL,
        created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX IF NOT EXISTS positions_size ON positions (width, aspect_ratio, diameter);
      CREATE INDEX IF NOT EXISTS positions_status ON positions (status);
    `);
  }

  add(p: NewPosition): number {
    const d = p.draft;
    const searchText = foldText(
      [d.brand, d.model, p.titleLt, p.titleRu, d.defects, d.city, d.dot].filter(Boolean).join(' ')
    );
    const result = this.db
      .prepare(
        `INSERT INTO positions (brand, model, width, aspect_ratio, diameter, season, studded, condition,
           quantity, price, search_text, draft_json, title_lt, title_ru, description_lt, description_ru,
           photos_json, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        d.brand ?? null,
        d.model ?? null,
        d.width ?? null,
        d.aspect_ratio ?? null,
        d.diameter ?? null,
        d.season ?? null,
        d.studded === undefined ? null : d.studded ? 1 : 0,
        d.condition ?? null,
        d.quantity ?? null,
        d.price ?? null,
        searchText,
        JSON.stringify(d),
        p.titleLt,
        p.titleRu,
        p.descriptionLt,
        p.descriptionRu,
        JSON.stringify(p.photos),
        p.createdBy
      );
    return Number(result.lastInsertRowid);
  }

  get(id: number): Position | null {
    const row = this.db.prepare('SELECT * FROM positions WHERE id = ?').get(id) as Row | undefined;
    return row === undefined ? null : toPosition(row);
  }

  setStatus(id: number, status: PositionStatus): boolean {
    const result = this.db
      .prepare(`UPDATE positions SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .run(status, id);
    return Number(result.changes) > 0;
  }

  delete(id: number): boolean {
    return Number(this.db.prepare('DELETE FROM positions WHERE id = ?').run(id).changes) > 0;
  }

  /** Newest first. Returns one page plus the total number of matches. */
  search(filter: SearchFilter, page = 0): { items: Position[]; total: number } {
    const where: string[] = [];
    const args: (string | number)[] = [];

    if (filter.id !== undefined) {
      where.push('id = ?');
      args.push(filter.id);
    } else {
      if (!filter.include_sold) where.push(`status = 'active'`);
      const eq = (column: string, value: string | number | undefined) => {
        if (value === undefined) return;
        where.push(`${column} = ?`);
        args.push(value);
      };
      eq('width', filter.width);
      eq('aspect_ratio', filter.aspect_ratio);
      eq('diameter', filter.diameter);
      eq('season', filter.season);
      eq('condition', filter.condition);
      if (filter.studded !== undefined) eq('studded', filter.studded ? 1 : 0);
      if (filter.brand) {
        where.push('lower(brand) = ?');
        args.push(filter.brand.toLowerCase());
      }
      if (filter.min_quantity !== undefined) {
        where.push('quantity >= ?');
        args.push(filter.min_quantity);
      }
      if (filter.max_price !== undefined) {
        where.push('price <= ?');
        args.push(filter.max_price);
      }
      const words = foldText([filter.model, filter.text].filter(Boolean).join(' '))
        .split(' ')
        .filter((word) => word.length >= 2);
      for (const word of words) {
        where.push(`search_text LIKE ? ESCAPE '\\'`);
        args.push(`%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      }
    }

    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = Number(
      (this.db.prepare(`SELECT count(*) AS n FROM positions ${clause}`).get(...args) as { n: number }).n
    );
    const rows = this.db
      .prepare(`SELECT * FROM positions ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...args, PAGE_SIZE, page * PAGE_SIZE) as unknown as Row[];
    return { items: rows.map(toPosition), total };
  }

  /** Brands the team has in stock — used to recognise a brand in a query. */
  knownBrands(): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT brand FROM positions WHERE brand IS NOT NULL')
      .all() as unknown as { brand: string }[];
    return rows.map((row) => row.brand);
  }

  close(): void {
    this.db.close();
  }
}
