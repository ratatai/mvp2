/**
 * Cross-user isolation check: RLS on listings/listing_images and the Storage
 * policies on the listing-images bucket, exercised by two real local users.
 *
 * LOCAL DISPOSABLE STACKS ONLY. See E2E_SAFETY.md and
 * tests/e2e/fixtures/README.md ("cross-user-isolation.mjs").
 *
 *   node tests/e2e/cross-user-isolation.mjs
 *
 * Reads only these variables (no env files are loaded):
 *   E2E_ISO_SUPABASE_URL   local API URL, loopback http only
 *   E2E_ISO_ANON_KEY       local anon/publishable key (never service_role)
 *   E2E_ISO_A_EMAIL, E2E_ISO_A_PASSWORD   synthetic owner A
 *   E2E_ISO_B_EMAIL, E2E_ISO_B_PASSWORD   synthetic user B
 *
 * Every guard runs before the first network request. Clients do not persist
 * sessions, and their fetch refuses other origins and redirects. Output is
 * check names, PASS/FAIL and status/error codes only: never passwords,
 * tokens, sessions or response bodies.
 *
 * Owner A creates one draft tyre, one Storage object and one image row. They
 * are left in place for inspection; the runner discards the whole stack.
 * Exit code 0 only if every check passes.
 */

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'listing-images';
const SLUG = 'e2e-iso-draft-tyre';
const FILE_NAME = 'e2e-iso-owner.png';
// 1x1 transparent PNG (67 bytes).
const PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64'
  )
);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const SYNTHETIC_DOMAINS = new Set(['example.test', 'example.invalid']);

class GuardError extends Error {}

// ---------------------------------------------------------------- guards ---
// All of these run before any client is created.

function requireVar(name) {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new GuardError(`${name} is not set.`);
  }
  return value;
}

/** Returns the origin of a loopback http URL with no credentials or path. */
function loopbackOrigin(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new GuardError('E2E_ISO_SUPABASE_URL is not a valid URL.');
  }
  if (
    url.protocol !== 'http:' ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username !== '' ||
    url.password !== '' ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new GuardError(
      'E2E_ISO_SUPABASE_URL must be a bare http URL on 127.0.0.1, localhost or [::1].'
    );
  }
  return url.origin;
}

/** Same rule as tests/e2e/synthetic-account.ts (kept inline: plain Node). */
function isSyntheticEmail(value) {
  const trimmed = value.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || trimmed.indexOf('@') !== at) return false;
  if (/\s/.test(trimmed.slice(0, at))) return false;
  return SYNTHETIC_DOMAINS.has(trimmed.slice(at + 1));
}

/** Rejects secret/service_role keys without printing any part of the key. */
function assertAnonKey(key) {
  if (key.startsWith('sb_secret_')) {
    throw new GuardError('E2E_ISO_ANON_KEY is a secret key; only the anon key is allowed.');
  }
  if (key.startsWith('sb_publishable_')) return;
  const parts = key.split('.');
  let role;
  try {
    role = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8')).role;
  } catch {
    role = undefined;
  }
  if (parts.length !== 3 || role !== 'anon') {
    throw new GuardError('E2E_ISO_ANON_KEY must be the local anon key (JWT role "anon").');
  }
}

function readConfig() {
  const origin = loopbackOrigin(requireVar('E2E_ISO_SUPABASE_URL'));
  const anonKey = requireVar('E2E_ISO_ANON_KEY');
  assertAnonKey(anonKey);

  const a = { email: requireVar('E2E_ISO_A_EMAIL'), password: requireVar('E2E_ISO_A_PASSWORD') };
  const b = { email: requireVar('E2E_ISO_B_EMAIL'), password: requireVar('E2E_ISO_B_PASSWORD') };
  for (const [label, user] of [['E2E_ISO_A_EMAIL', a], ['E2E_ISO_B_EMAIL', b]]) {
    if (!isSyntheticEmail(user.email)) {
      throw new GuardError(`${label} must be on example.test or example.invalid.`);
    }
  }
  if (a.email.trim().toLowerCase() === b.email.trim().toLowerCase()) {
    throw new GuardError('E2E_ISO_A_EMAIL and E2E_ISO_B_EMAIL must be different users.');
  }
  return { origin, anonKey, a, b };
}

// --------------------------------------------------------------- clients ---

function restrictedFetch(origin) {
  return (input, init) => {
    const target = input instanceof Request ? input.url : String(input);
    if (new URL(target).origin !== origin) {
      return Promise.reject(new GuardError('Refused a request to a non-local origin.'));
    }
    return fetch(input, { ...init, redirect: 'error' });
  };
}

function newClient({ origin, anonKey }) {
  return createClient(origin, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: restrictedFetch(origin) },
  });
}

async function signIn(client, user, label) {
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email.trim(),
    password: user.password,
  });
  if (error !== null || !data.user) {
    throw new GuardError(`Sign-in failed for ${label} (status ${error?.status ?? 'none'}).`);
  }
  return data.user.id;
}

// ---------------------------------------------------------------- checks ---

const results = [];

async function check(name, fn) {
  const problems = [];
  try {
    await fn((ok, message) => {
      if (!ok) problems.push(message);
    });
  } catch (err) {
    problems.push(err instanceof GuardError ? err.message : `threw ${err?.name ?? 'error'}`);
  }
  results.push({ name, ok: problems.length === 0 });
  console.log(`${problems.length === 0 ? 'PASS' : 'FAIL'}  ${name}`);
  for (const p of problems) console.log(`      - ${p}`);
}

/** Error/status code only; never the message or body. */
function code(error) {
  return error?.code ?? error?.statusCode ?? error?.status ?? 'none';
}

/** A write that RLS refused: either an error, or success touching 0 rows. */
function refused({ error, count }) {
  return error !== null || count === 0;
}

function same(x, y) {
  return JSON.stringify(x) === JSON.stringify(y);
}

async function readListing(client, id) {
  return client.from('listings').select('*').eq('id', id);
}

async function readImages(client, listingId) {
  return client.from('listing_images').select('*').eq('listing_id', listingId).order('id');
}

async function downloadBytes(client, path) {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error !== null || data === null) return { error: error ?? new Error('empty'), bytes: null };
  return { error: null, bytes: new Uint8Array(await data.arrayBuffer()) };
}

function sameBytes(x, y) {
  return x !== null && x.length === y.length && x.every((v, i) => v === y[i]);
}

async function main() {
  const config = readConfig();
  const ownerA = newClient(config);
  const userB = newClient(config);
  const anon = newClient(config);

  const ctx = { aId: '', bId: '', listingId: '', path: '', listing: null, image: null };

  await check('1. both synthetic users sign in as distinct users; catalog starts empty', async (expect) => {
    ctx.aId = await signIn(ownerA, config.a, 'A');
    ctx.bId = await signIn(userB, config.b, 'B');
    expect(ctx.aId !== ctx.bId, 'A and B resolved to the same user id');

    const own = await ownerA.from('listings').select('id', { count: 'exact', head: true });
    expect(own.error === null && own.count === 0, `A already owns listings (count ${own.count}, code ${code(own.error)})`);
    const pub = await anon.from('listings').select('id', { count: 'exact', head: true });
    expect(pub.error === null && pub.count === 0, `public catalog is not empty (count ${pub.count}, code ${code(pub.error)})`);
  });
  if (!ctx.aId || !ctx.bId || ctx.aId === ctx.bId) return;

  await check('2. owner A creates, reads and updates a draft tyre, its Storage object and image row', async (expect) => {
    const created = await ownerA
      .from('listings')
      .insert({
        user_id: ctx.aId,
        category: 'padangos',
        title: 'E2E isolation draft tyre',
        description: 'Synthetic E2E isolation fixture, no photos of people or contact data.',
        condition: 'used',
        price: 100,
        quantity: 4,
        city: 'Vilnius',
        specs: { brand: 'E2E', width: 205, aspect_ratio: 55, diameter: 16, season: 'summer' },
        status: 'draft',
        slug: SLUG,
      })
      .select('id')
      .single();
    if (created.error !== null) throw new GuardError(`A insert listing failed (code ${code(created.error)}).`);
    ctx.listingId = created.data.id;
    ctx.path = `${ctx.aId}/${ctx.listingId}/${FILE_NAME}`;

    const updated = await ownerA
      .from('listings')
      .update({ price: 101 }, { count: 'exact' })
      .eq('id', ctx.listingId);
    expect(updated.error === null && updated.count === 1, `A update own listing (count ${updated.count}, code ${code(updated.error)})`);

    const upload = await ownerA.storage
      .from(BUCKET)
      .upload(ctx.path, PNG, { contentType: 'image/png', upsert: false });
    if (upload.error !== null) throw new GuardError(`A upload failed (code ${code(upload.error)}).`);
    const own = await downloadBytes(ownerA, ctx.path);
    expect(sameBytes(own.bytes, PNG), `A download differs from upload (code ${code(own.error)})`);

    const publicUrl = ownerA.storage.from(BUCKET).getPublicUrl(ctx.path).data.publicUrl;
    const image = await ownerA
      .from('listing_images')
      .insert({ listing_id: ctx.listingId, storage_path: ctx.path, public_url: publicUrl, position: 0, is_primary: true })
      .select('id')
      .single();
    if (image.error !== null) throw new GuardError(`A insert image row failed (code ${code(image.error)}).`);
    const imageUpdate = await ownerA
      .from('listing_images')
      .update({ position: 0 }, { count: 'exact' })
      .eq('id', image.data.id);
    expect(imageUpdate.error === null && imageUpdate.count === 1, `A update own image row (count ${imageUpdate.count}, code ${code(imageUpdate.error)})`);

    const listing = await readListing(ownerA, ctx.listingId);
    const images = await readImages(ownerA, ctx.listingId);
    expect(listing.data?.length === 1 && listing.data[0].price == 101 && listing.data[0].user_id === ctx.aId, 'A cannot read back its listing as written');
    expect(images.data?.length === 1 && images.data[0].storage_path === ctx.path, 'A cannot read back its image row as written');
    ctx.listing = listing.data?.[0] ?? null;
    ctx.image = images.data?.[0] ?? null;
  });
  if (ctx.listing === null || ctx.image === null) return;

  /** Owner A's view must be exactly the snapshot from check 2. */
  async function expectUnchanged(expect, after) {
    const listing = await readListing(ownerA, ctx.listingId);
    expect(listing.error === null && same(listing.data, [ctx.listing]), `A's listing changed after ${after}`);
    const images = await readImages(ownerA, ctx.listingId);
    expect(images.error === null && same(images.data, [ctx.image]), `A's image rows changed after ${after}`);
  }

  await check('3. B and anon cannot read A\'s draft or its image row', async (expect) => {
    for (const [who, client] of [['B', userB], ['anon', anon]]) {
      const listing = await readListing(client, ctx.listingId);
      expect(listing.error === null && listing.data?.length === 0, `${who} read A's draft (rows ${listing.data?.length}, code ${code(listing.error)})`);
      const bySlug = await client.from('listings').select('id').eq('slug', SLUG);
      expect(bySlug.error === null && bySlug.data?.length === 0, `${who} found A's draft by slug`);
      const images = await readImages(client, ctx.listingId);
      expect(images.error === null && images.data?.length === 0, `${who} read A's image row (rows ${images.data?.length}, code ${code(images.error)})`);
    }
  });

  await check('4. B cannot update, publish or reassign A\'s listing, or create one as A', async (expect) => {
    const attempts = {
      'price update': { price: 1 },
      'publish': { status: 'active' },
      'reassign to B': { user_id: ctx.bId },
    };
    for (const [label, values] of Object.entries(attempts)) {
      const res = await userB.from('listings').update(values, { count: 'exact' }).eq('id', ctx.listingId);
      expect(refused(res), `B ${label} touched ${res.count} row(s)`);
    }
    const asA = await userB.from('listings').insert({
      ...Object.fromEntries(Object.entries(ctx.listing).filter(([k]) => !['id', 'created_at', 'updated_at', 'published_at'].includes(k))),
      slug: `${SLUG}-by-b`,
    });
    expect(asA.error !== null, 'B inserted a listing owned by A');
    await expectUnchanged(expect, 'B update attempts');
  });

  await check('5. B cannot delete A\'s listing', async (expect) => {
    const res = await userB.from('listings').delete({ count: 'exact' }).eq('id', ctx.listingId);
    expect(refused(res), `B delete touched ${res.count} row(s)`);
    await expectUnchanged(expect, 'B delete attempt');
  });

  await check('6. B cannot insert, update or delete image metadata on A\'s listing', async (expect) => {
    const fakePath = `${ctx.bId}/${ctx.listingId}/e2e-iso-b.png`;
    const inserted = await userB.from('listing_images').insert({
      listing_id: ctx.listingId,
      storage_path: fakePath,
      public_url: userB.storage.from(BUCKET).getPublicUrl(fakePath).data.publicUrl,
      position: 1,
      is_primary: false,
    });
    expect(inserted.error !== null, 'B inserted an image row on A\'s listing');
    const updated = await userB
      .from('listing_images')
      .update({ position: 9, is_primary: false }, { count: 'exact' })
      .eq('id', ctx.image.id);
    expect(refused(updated), `B image update touched ${updated.count} row(s)`);
    const deleted = await userB.from('listing_images').delete({ count: 'exact' }).eq('id', ctx.image.id);
    expect(refused(deleted), `B image delete touched ${deleted.count} row(s)`);
    await expectUnchanged(expect, 'B image metadata attempts');
  });

  await check('7. B cannot upload into, replace or remove A\'s Storage object', async (expect) => {
    const other = Uint8Array.from(PNG);
    other[other.length - 5] ^= 0xff; // different bytes, so a replacement would show
    const bucketB = userB.storage.from(BUCKET);
    const extraPath = `${ctx.aId}/${ctx.listingId}/e2e-iso-b.png`;

    const attempts = [
      ['upload new object into A\'s folder', () => bucketB.upload(extraPath, other, { contentType: 'image/png', upsert: false })],
      ['upload over A\'s object', () => bucketB.upload(ctx.path, other, { contentType: 'image/png', upsert: false })],
      ['upsert over A\'s object', () => bucketB.upload(ctx.path, other, { contentType: 'image/png', upsert: true })],
      ['update A\'s object', () => bucketB.update(ctx.path, other, { contentType: 'image/png' })],
      ['upload under B\'s folder for A\'s listing', () => bucketB.upload(`${ctx.bId}/${ctx.listingId}/e2e-iso-b.png`, other, { contentType: 'image/png', upsert: false })],
      ['move A\'s object', () => bucketB.move(ctx.path, `${ctx.bId}/${ctx.listingId}/moved.png`)],
    ];
    for (const [label, run] of attempts) {
      const { error } = await run();
      expect(error !== null, `B ${label} succeeded`);
    }

    // remove() can report success while RLS deleted nothing, so its result is
    // not trusted: the object and its metadata are checked afterwards instead.
    await bucketB.remove([ctx.path]);

    const own = await downloadBytes(ownerA, ctx.path);
    expect(sameBytes(own.bytes, PNG), `A's object is missing or not byte-identical (code ${code(own.error)})`);
    const listed = await ownerA.storage.from(BUCKET).list(`${ctx.aId}/${ctx.listingId}`);
    const names = (listed.data ?? []).map((o) => o.name).sort();
    expect(listed.error === null && same(names, [FILE_NAME]), `A's folder holds ${names.length} object(s), expected only ${FILE_NAME}`);
    await expectUnchanged(expect, 'B Storage attempts');
  });

  await check('8. owner A still controls its listing after all of B\'s attempts', async (expect) => {
    const res = await ownerA
      .from('listings')
      .update({ title: 'E2E isolation draft tyre (owner check)' }, { count: 'exact' })
      .eq('id', ctx.listingId);
    expect(res.error === null && res.count === 1, `A final update (count ${res.count}, code ${code(res.error)})`);
    const listing = await readListing(ownerA, ctx.listingId);
    const row = listing.data?.[0];
    expect(row?.user_id === ctx.aId && row?.status === 'draft' && row?.price == 101, 'A\'s listing owner, status or price is wrong');
  });
}

try {
  await main();
} catch (err) {
  console.log(`ABORT ${err instanceof GuardError ? err.message : `unexpected ${err?.name ?? 'error'}`}`);
  process.exitCode = 1;
}
const failed = results.filter((r) => !r.ok).length;
if (results.length < 8 || failed > 0) process.exitCode = 1;
console.log(`${results.length - failed}/${results.length} checks passed (8 expected).`);
