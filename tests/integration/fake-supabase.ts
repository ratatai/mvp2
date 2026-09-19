/**
 * A tiny, chainable fake of the Supabase client.
 *
 * The integration tests never touch a database. Instead this fake records the
 * query the repository *asked* it to build — every chained call, in order —
 * and resolves to a canned `{ data, error, count }` payload. That makes it
 * possible to assert on the query shape (which is where the interesting
 * invariants live: status scoping, owner scoping, spec paths, sorting,
 * pagination) without a network round trip.
 *
 * Only the methods the repositories actually call are implemented; anything
 * else is a deliberate omission so that a new repository call site shows up as
 * a loud failure rather than as a silently ignored chain link.
 */

/* -------------------------------------------------------------------------- */
/* Recorded shapes                                                             */
/* -------------------------------------------------------------------------- */

export interface RecordedCall {
  readonly method: string;
  readonly args: readonly unknown[];
}

export interface RecordedQuery {
  readonly table: string;
  readonly calls: readonly RecordedCall[];
}

export interface RecordedStorageCall {
  readonly bucket: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

/**
 * The error shape PostgREST returns. Declared locally rather than imported so
 * the fake stays independent of the Supabase package version.
 */
export interface FakePostgrestError {
  readonly name: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
  readonly code: string;
}

/** Builds a PostgREST-shaped error. `code` is what the repository maps on. */
export function pgError(code: string, message: string): FakePostgrestError {
  return {
    name: 'PostgrestError',
    message,
    details: `detail for ${message}`,
    hint: `hint for ${message}`,
    code,
  };
}

/** A canned answer for one awaited query. Missing fields default to null. */
export interface FakeResult {
  readonly data?: unknown;
  readonly error?: FakePostgrestError | null;
  readonly count?: number | null;
}

interface ResolvedResult {
  readonly data: unknown;
  readonly error: FakePostgrestError | null;
  readonly count: number | null;
}

function resolve(result: FakeResult | undefined): ResolvedResult {
  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
    count: result?.count ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Query builder                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Every chained method returns `this` and appends to `calls`. The builder is
 * a thenable, so `await supabase.from(...).select(...).eq(...)` resolves the
 * same way the real client does.
 */
class FakeQueryBuilder implements RecordedQuery, PromiseLike<ResolvedResult> {
  readonly table: string;
  readonly calls: RecordedCall[] = [];

  readonly #resolver: (query: RecordedQuery) => ResolvedResult;

  constructor(table: string, resolver: (query: RecordedQuery) => ResolvedResult) {
    this.table = table;
    this.#resolver = resolver;
  }

  #record(method: string, args: readonly unknown[]): this {
    this.calls.push({ method, args });
    return this;
  }

  /* Operations ----------------------------------------------------------- */

  select(...args: readonly unknown[]): this {
    return this.#record('select', args);
  }

  insert(...args: readonly unknown[]): this {
    return this.#record('insert', args);
  }

  update(...args: readonly unknown[]): this {
    return this.#record('update', args);
  }

  delete(...args: readonly unknown[]): this {
    return this.#record('delete', args);
  }

  /* Filters -------------------------------------------------------------- */

  eq(...args: readonly unknown[]): this {
    return this.#record('eq', args);
  }

  ilike(...args: readonly unknown[]): this {
    return this.#record('ilike', args);
  }

  or(...args: readonly unknown[]): this {
    return this.#record('or', args);
  }

  filter(...args: readonly unknown[]): this {
    return this.#record('filter', args);
  }

  gte(...args: readonly unknown[]): this {
    return this.#record('gte', args);
  }

  lte(...args: readonly unknown[]): this {
    return this.#record('lte', args);
  }

  /* Shaping -------------------------------------------------------------- */

  order(...args: readonly unknown[]): this {
    return this.#record('order', args);
  }

  range(...args: readonly unknown[]): this {
    return this.#record('range', args);
  }

  limit(...args: readonly unknown[]): this {
    return this.#record('limit', args);
  }

  maybeSingle(...args: readonly unknown[]): this {
    return this.#record('maybeSingle', args);
  }

  single(...args: readonly unknown[]): this {
    return this.#record('single', args);
  }

  /* Thenable ------------------------------------------------------------- */

  then<TFulfilled = ResolvedResult, TRejected = never>(
    onfulfilled?:
      | ((value: ResolvedResult) => TFulfilled | PromiseLike<TFulfilled>)
      | null,
    onrejected?: ((reason: unknown) => TRejected | PromiseLike<TRejected>) | null
  ): PromiseLike<TFulfilled | TRejected> {
    return Promise.resolve(this.#resolver(this)).then(onfulfilled, onrejected);
  }
}

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */

export interface FakeSupabaseOptions {
  /**
   * Canned answers per table, consumed in order. A table that runs out of
   * queued answers falls back to `fallback`.
   */
  readonly responses?: Readonly<Record<string, readonly FakeResult[]>>;
  readonly fallback?: FakeResult;
  /** Error returned by `storage.from(...).remove(...)`. */
  readonly storageRemoveError?: { readonly message: string } | null;
}

export interface FakeSupabase {
  /** Hand this to the mocked `createSupabaseServerClient`. */
  readonly client: unknown;
  /** Every query built, in the order `from()` was called. */
  readonly queries: readonly RecordedQuery[];
  /** Every Storage call, in order. */
  readonly storageCalls: readonly RecordedStorageCall[];
  queriesFor(table: string): readonly RecordedQuery[];
  /** The single query against `table`; fails loudly when there is not exactly one. */
  onlyQueryFor(table: string): RecordedQuery;
}

export function createFakeSupabase(
  options: FakeSupabaseOptions = {}
): FakeSupabase {
  const queries: RecordedQuery[] = [];
  const storageCalls: RecordedStorageCall[] = [];

  // One cursor per table, so queued answers are handed out in call order.
  const cursors = new Map<string, number>();

  function nextResult(table: string): ResolvedResult {
    const queue = options.responses?.[table];
    const index = cursors.get(table) ?? 0;
    cursors.set(table, index + 1);

    if (queue === undefined) return resolve(options.fallback);
    return resolve(queue[index] ?? options.fallback);
  }

  // The answer is chosen when the query is *awaited*, not when it is built,
  // so the resolver sees the finished chain.
  const pending = new Map<RecordedQuery, ResolvedResult>();

  function resolverFor(table: string) {
    return (query: RecordedQuery): ResolvedResult => {
      const already = pending.get(query);
      if (already !== undefined) return already;

      const result = nextResult(table);
      pending.set(query, result);
      return result;
    };
  }

  const client = {
    from(table: string): FakeQueryBuilder {
      const builder = new FakeQueryBuilder(table, resolverFor(table));
      queries.push(builder);
      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          async remove(paths: readonly string[]) {
            storageCalls.push({ bucket, method: 'remove', args: [paths] });
            return {
              data: null,
              error: options.storageRemoveError ?? null,
            };
          },
          async upload(path: string, file: unknown, config?: unknown) {
            storageCalls.push({
              bucket,
              method: 'upload',
              args: [path, file, config],
            });
            return { data: { path }, error: null };
          },
          getPublicUrl(path: string) {
            storageCalls.push({ bucket, method: 'getPublicUrl', args: [path] });
            return { data: { publicUrl: `https://example.test/${path}` } };
          },
        };
      },
    },
  };

  return {
    client,
    queries,
    storageCalls,
    queriesFor(table: string): readonly RecordedQuery[] {
      return queries.filter((query) => query.table === table);
    },
    onlyQueryFor(table: string): RecordedQuery {
      const matches = queries.filter((query) => query.table === table);
      const first = matches[0];

      if (first === undefined) {
        throw new Error(`No query was built against "${table}".`);
      }
      if (matches.length > 1) {
        throw new Error(
          `Expected exactly one query against "${table}", found ${matches.length}.`
        );
      }

      return first;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Assertion helpers                                                           */
/* -------------------------------------------------------------------------- */

export function callsOf(
  query: RecordedQuery,
  method: string
): readonly RecordedCall[] {
  return query.calls.filter((call) => call.method === method);
}

/** Every `(column, value)` pair passed to `.eq()`, in order. */
export function eqPairs(
  query: RecordedQuery
): ReadonlyArray<readonly [unknown, unknown]> {
  return callsOf(query, 'eq').map((call) => [call.args[0], call.args[1]] as const);
}

/** Every `(path, operator, value)` triple passed to `.filter()`, in order. */
export function filterTriples(
  query: RecordedQuery
): ReadonlyArray<readonly [unknown, unknown, unknown]> {
  return callsOf(query, 'filter').map(
    (call) => [call.args[0], call.args[1], call.args[2]] as const
  );
}

/** Every `(column, ascending)` pair passed to `.order()`, in order. */
export function orderPairs(
  query: RecordedQuery
): ReadonlyArray<readonly [unknown, boolean | undefined]> {
  return callsOf(query, 'order').map((call) => {
    const config = call.args[1];
    const ascending =
      typeof config === 'object' && config !== null && 'ascending' in config
        ? (config as { ascending?: unknown }).ascending
        : undefined;

    return [
      call.args[0],
      typeof ascending === 'boolean' ? ascending : undefined,
    ] as const;
  });
}

/** True when `.eq(column, value)` was recorded on this query. */
export function hasEq(
  query: RecordedQuery,
  column: string,
  value: unknown
): boolean {
  return eqPairs(query).some(([col, val]) => col === column && val === value);
}

/** The first argument of the first call to `method`, or undefined. */
export function firstArgOf(query: RecordedQuery, method: string): unknown {
  return callsOf(query, method)[0]?.args[0];
}
