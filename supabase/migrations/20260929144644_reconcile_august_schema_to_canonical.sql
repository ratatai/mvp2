-- ===========================================================================
-- RATATAI marketplace — reconcile the August legacy schema to the canonical
-- contract defined by 001_initial_schema.sql + 002_security_hardening.sql.
-- ---------------------------------------------------------------------------
-- SOURCES OF TRUTH
--
-- Every expected value in this file was taken from an artefact, never guessed:
--
--   * the legacy shape, down to the column list, comes from the schema-only
--     backup ratatai-before-schema-migration-2026-09-29.sql. Note in particular
--     that the August listings table ALREADY has a `specs jsonb` column; it is
--     the absence of slug / moderation_status / currency / country / quantity /
--     condition / published_at that separates it from the canonical table;
--   * the four legacy Storage policies, the listing-images bucket settings and
--     the auth.users trigger with its function body come from the read-only
--     catalogue export of the target database;
--   * the canonical columns, constraints, indexes, RLS flags, policies and
--     triggers were read back out of a database built by running the real
--     001_initial_schema.sql and 002_security_hardening.sql.
--
-- WHAT IT DOES
--
--   1. confirmed August legacy  -> convert, preserving every profile row
--   2. already canonical        -> VERIFY ONLY. Not one write, not one DDL
--                                  statement. `create ... if not exists` is not
--                                  a conformance check, so it is not used as
--                                  one: the schema is compared against the
--                                  canonical contract and any deviation stops
--                                  the migration.
--   3. anything else            -> RAISE EXCEPTION before the first change
--
-- Classification is a conjunction of table, view, column and enum-type markers.
-- Both classifications must be mutually exclusive or the migration refuses.
--
-- WHAT COUNTS AS BLOCKED
--
-- Names alone are never trusted. A Storage or table policy is accepted only
-- when its command, roles, permissive flag, USING and WITH CHECK expressions
-- all match the recorded definition; one policy more, one policy fewer, or one
-- altered expression stops the migration. The same holds for the auth.users
-- trigger, which is matched on its timing, event, level, WHEN clause, target
-- function and the function's own body, security and search_path settings.
--
-- The conformance check in section 4 is held to the same standard, because a
-- matching name proves nothing about what an object does:
--
--   columns      type, nullability, default, numeric precision and scale,
--                identity, generated
--   constraints  table, type, full definition, validated, deferrable, deferred
--   indexes      table, full definition (expressions, operator classes, sort
--                order, partial predicate), unique, valid, ready
--   triggers     state (a disabled trigger is not an enabled one), timing and
--                events, WHEN clause, argument count, target function
--   functions    verbatim body, language, arguments, return type,
--                SECURITY DEFINER/INVOKER, search_path, volatility
--   policies     command, roles, permissive, USING, WITH CHECK
--   view         definition, columns, reloptions (security_invoker changes who
--                the view reads as), the SELECT grant 002 makes, and the
--                absence of any trigger or extra rewrite rule that would make
--                the view writable
--   RLS          enabled everywhere, forced on profiles
--   bucket       public, file_size_limit, allowed_mime_types
--
-- Nothing found this way is repaired automatically. A deviation is reported and
-- the migration stops, on both paths.
--
-- Expression comparison is textual over the database's own deparse
-- (pg_get_expr), with runs of whitespace collapsed to a single space. Function
-- bodies are the exception and are compared verbatim, with only CRLF folded to
-- LF: collapsing whitespace there would fold the statements that follow a `--`
-- comment onto the comment's line, so a body whose code had been commented out
-- would still compare equal.
-- It is therefore tied to the PostgreSQL major version that produced the
-- recorded values; after a major upgrade the recorded strings must be refreshed
-- from a fresh export. Every mismatch is reported with both sides so the
-- difference is visible rather than guessed at.
--
-- SAFETY
--
-- * The whole migration is one DO statement, so it is atomic no matter how it
--   is applied; it does not rely on the caller opening a transaction.
-- * A transaction-scoped advisory lock serialises concurrent attempts.
-- * Before anything destructive the marketplace tables are locked ACCESS
--   EXCLUSIVE and storage.objects SHARE, and only then counted, so no row can
--   appear between the check and the drop.
-- * No DROP ... CASCADE anywhere. Dependencies are enumerated and reported.
-- * Legacy profile rows live in an ON COMMIT DROP temporary table for the
--   duration of the transaction. Nothing is archived into schema public: an
--   archived table would keep the legacy grants and sit on the PostgREST API
--   surface for ever.
--
-- AUTH
--
-- auth.users rows are never written. The contents of the table are hashed
-- before and after and compared; the hash itself is never printed. The only
-- objects touched in the auth schema are the legacy signup trigger
-- trg_on_auth_user_created, which is removed after its definition has been
-- verified, and the canonical on_auth_user_created, which replaces it — the
-- two have different names, so leaving the old one in place would mean two
-- signup triggers.
-- ===========================================================================

do $reconcile$
declare
  -- inventory ---------------------------------------------------------------
  rels                text[];
  cols                text[];
  enum_types          text[];
  legacy_cat_enum     boolean;
  legacy_status_enum  boolean;
  is_canonical        boolean;
  is_legacy           boolean;

  -- findings ----------------------------------------------------------------
  blocked             text[] := '{}';
  dependants          text[] := '{}';
  unexpected          text[] := '{}';

  -- work --------------------------------------------------------------------
  n                   bigint;
  profiles_before     bigint;
  auth_digest_before  text;
  auth_digest_after   text;
  rec                 record;
  enum_name           text;
  snapshot_cols       text[];
  missing_cols        text[];
  col_list            text;
  val_list            text;
  display_expr        text;
  view_def            text;
  view_opts           text;
  view_cols           text;

  -- the canonical listing_sellers body, as 001 defines it
  canonical_view_def  constant text :=
    'SELECT l.id AS listing_id, p.display_name, p.city, CASE WHEN p.phone_is_public THEN p.phone ELSE NULL::text END AS phone FROM listings l JOIN profiles p ON p.id = l.user_id WHERE l.status = ''active''::text AND l.moderation_status = ''approved''::text;';

  -- the legacy signup trigger, exactly as the read-only export recorded it ---
  legacy_trigger_name constant text := 'trg_on_auth_user_created';
  legacy_trigger_func constant text := 'public.handle_new_user';
  legacy_trigger_type constant smallint := 5;  -- ROW (1) + INSERT (4), AFTER
  legacy_func_src     constant text :=
    '
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>''full_name'',
    NEW.raw_user_meta_data->>''avatar_url''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
';
  legacy_func_lang    constant text := 'plpgsql';
  legacy_func_args    constant text := '';
  legacy_func_rettype constant text := 'trigger';
begin
  ---------------------------------------------------------------------------
  -- 0. Serialise. Two concurrent runs would both pass the emptiness checks.
  ---------------------------------------------------------------------------
  perform pg_advisory_xact_lock(hashtext('ratatai:reconcile_august_schema_to_canonical'));

  ---------------------------------------------------------------------------
  -- 1. Inventory. Extension-owned relations are excluded so that an installed
  --    extension is not mistaken for an unknown application table.
  ---------------------------------------------------------------------------
  select coalesce(array_agg(c.relname::text order by c.relname), '{}')
    into rels
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e');

  select coalesce(array_agg(table_name || '.' || column_name), '{}')
    into cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('profiles', 'listings', 'listing_images', 'favorites');

  select coalesce(array_agg(t.typname::text order by t.typname), '{}')
    into enum_types
  from pg_type t
  join pg_namespace ns on ns.oid = t.typnamespace
  where ns.nspname = 'public' and t.typtype = 'e';

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings'
      and column_name = 'category' and udt_name = 'category_type'
  ) into legacy_cat_enum;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'listings'
      and column_name = 'status' and udt_name = 'listing_status'
  ) into legacy_status_enum;

  ---------------------------------------------------------------------------
  -- 2. Classification.
  ---------------------------------------------------------------------------
  is_canonical :=
        'profiles'                       = any(rels)
    and 'listings'                       = any(rels)
    and 'listing_images'                 = any(rels)
    and 'listing_sellers'                = any(rels)
    and 'profiles.display_name'          = any(cols)
    and 'profiles.phone_is_public'       = any(cols)
    and 'profiles.preferred_language'    = any(cols)
    and 'profiles.full_name'            <> all(cols)
    and 'profiles.username'             <> all(cols)
    and 'profiles.is_dealer'            <> all(cols)
    and 'listings.user_id'               = any(cols)
    and 'listings.specs'                 = any(cols)
    and 'listings.slug'                  = any(cols)
    and 'listings.moderation_status'     = any(cols)
    and 'listings.currency'              = any(cols)
    and 'listings.country'               = any(cols)
    and 'listings.quantity'              = any(cols)
    and 'listings.condition'             = any(cols)
    and 'listings.published_at'          = any(cols)
    and 'listing_images.storage_path'    = any(cols)
    and 'listing_images.public_url'      = any(cols)
    and 'listing_images.position'        = any(cols)
    and 'listing_images.is_primary'      = any(cols)
    and 'favorites'                     <> all(rels)
    and 'category_type'                 <> all(enum_types)
    and 'listing_status'                <> all(enum_types);

  -- August legacy, per the schema-only backup: profiles carries full_name,
  -- username and is_dealer; listings carries specs (it always did) but none of
  -- the canonical commerce columns; both enums are in use as column types;
  -- listing_images has storage_path but no public_url; favorites exists.
  is_legacy :=
        'profiles'                       = any(rels)
    and 'listings'                       = any(rels)
    and 'listing_images'                 = any(rels)
    and 'favorites'                      = any(rels)
    and 'profiles.full_name'             = any(cols)
    and 'profiles.username'              = any(cols)
    and 'profiles.is_dealer'             = any(cols)
    and 'profiles.display_name'         <> all(cols)
    and 'profiles.phone_is_public'      <> all(cols)
    and 'profiles.preferred_language'   <> all(cols)
    and 'category_type'                  = any(enum_types)
    and 'listing_status'                 = any(enum_types)
    and legacy_cat_enum
    and legacy_status_enum
    and 'listings.specs'                 = any(cols)
    and 'listings.slug'                 <> all(cols)
    and 'listings.moderation_status'    <> all(cols)
    and 'listings.currency'             <> all(cols)
    and 'listings.country'              <> all(cols)
    and 'listings.quantity'             <> all(cols)
    and 'listings.condition'            <> all(cols)
    and 'listings.published_at'         <> all(cols)
    and 'listing_images.storage_path'    = any(cols)
    and 'listing_images.public_url'     <> all(cols)
    and 'listing_sellers'               <> all(rels);

  if is_canonical and is_legacy then
    raise exception
      'RATATAI reconcile: schema matches BOTH signatures at once, which is impossible; nothing was changed.'
      using errcode = 'raise_exception';
  end if;

  if not is_canonical and not is_legacy then
    raise exception
      'RATATAI reconcile: schema is neither the confirmed August legacy schema nor the canonical schema (unknown or partially converted); nothing was changed.%',
      format(
        E'\n  public relations : %s\n  relevant columns : %s\n  public enum types: %s\n  listings.category is category_type: %s\n  listings.status is listing_status  : %s',
        array_to_string(rels, ', '), array_to_string(cols, ', '),
        array_to_string(enum_types, ', '), legacy_cat_enum, legacy_status_enum)
      using errcode = 'raise_exception';
  end if;

  -- Whole-row digest of auth.users. Never printed, only compared.
  select md5(coalesce(string_agg(to_jsonb(u)::text, '|' order by u.id), ''))
    into auth_digest_before
  from auth.users u;

  ---------------------------------------------------------------------------
  -- 3. Legacy path.
  ---------------------------------------------------------------------------
  if is_legacy then
    raise notice 'RATATAI reconcile: confirmed August legacy schema; verifying before converting.';

    -------------------------------------------------------------------------
    -- 3.1 Every policy on storage.objects and on the legacy public tables is
    --     matched against the recorded definition. Command, roles, permissive
    --     flag, USING and WITH CHECK all have to agree. One policy more, one
    --     fewer or one altered expression is a BLOCKED, not a warning.
    --
    --     storage_listing_images_update_own genuinely has WITH CHECK = null in
    --     the target database. That is recorded as-is; it is not "corrected"
    --     into a copy of its USING clause.
    -------------------------------------------------------------------------
    for rec in
      with expected(relation, policyname, cmd, roles, qual, with_check) as (
        values
          ('public.favorites', 'favorites_delete_own', 'DELETE', 'authenticated',
           '(( SELECT auth.uid() AS uid) = user_id)', ''),
          ('public.favorites', 'favorites_insert_own', 'INSERT', 'authenticated',
           '', '((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id))'),
          ('public.favorites', 'favorites_select_own', 'SELECT', 'authenticated',
           '(( SELECT auth.uid() AS uid) = user_id)', ''),
          ('public.listing_images', 'listing_images_delete_own', 'DELETE', 'authenticated',
           '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))', ''),
          ('public.listing_images', 'listing_images_insert_own', 'INSERT', 'authenticated',
           '', '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))'),
          ('public.listing_images', 'listing_images_select_active', 'SELECT', 'anon,authenticated',
           '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND ((l.status = ''active''::listing_status) OR (l.user_id = ( SELECT auth.uid() AS uid))))))', ''),
          ('public.listing_images', 'listing_images_update_own', 'UPDATE', 'authenticated',
           '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = ( SELECT auth.uid() AS uid)))))', ''),
          ('public.listings', 'listings_delete_own', 'DELETE', 'authenticated',
           '(( SELECT auth.uid() AS uid) = user_id)', ''),
          ('public.listings', 'listings_insert_authenticated', 'INSERT', 'authenticated',
           '', '((( SELECT auth.uid() AS uid) IS NOT NULL) AND (( SELECT auth.uid() AS uid) = user_id))'),
          ('public.listings', 'listings_select_active', 'SELECT', 'anon,authenticated',
           '(status = ''active''::listing_status)', ''),
          ('public.listings', 'listings_select_own', 'SELECT', 'authenticated',
           '(( SELECT auth.uid() AS uid) = user_id)', ''),
          ('public.listings', 'listings_update_own', 'UPDATE', 'authenticated',
           '(( SELECT auth.uid() AS uid) = user_id)', '(( SELECT auth.uid() AS uid) = user_id)'),
          ('public.profiles', 'profiles_insert_own', 'INSERT', 'authenticated',
           '', '(( SELECT auth.uid() AS uid) = id)'),
          ('public.profiles', 'profiles_select_active_seller', 'SELECT', 'anon,authenticated',
           '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.user_id = profiles.id) AND (l.status = ''active''::listing_status))))', ''),
          ('public.profiles', 'profiles_select_own', 'SELECT', 'authenticated',
           '(( SELECT auth.uid() AS uid) = id)', ''),
          ('public.profiles', 'profiles_update_own', 'UPDATE', 'authenticated',
           '(( SELECT auth.uid() AS uid) = id)', '(( SELECT auth.uid() AS uid) = id)'),
          ('storage.objects', 'storage_listing_images_delete_own', 'DELETE', 'authenticated',
           '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))', ''),
          ('storage.objects', 'storage_listing_images_insert_own', 'INSERT', 'authenticated',
           '', '((bucket_id = ''listing-images''::text) AND (( SELECT auth.uid() AS uid) IS NOT NULL) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))'),
          ('storage.objects', 'storage_listing_images_select_public', 'SELECT', 'anon,authenticated',
           '(bucket_id = ''listing-images''::text)', ''),
          ('storage.objects', 'storage_listing_images_update_own', 'UPDATE', 'authenticated',
           '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text))', '')
      ),
      actual as (
        select (ns.nspname || '.' || c.relname)::text as relation,
               pol.polname::text                      as policyname,
               case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                               when 'w' then 'UPDATE' when 'd' then 'DELETE'
                               else 'ALL' end          as cmd,
               coalesce((select string_agg(r.rolname::text, ',' order by r.rolname)
                         from pg_roles r where r.oid = any(pol.polroles)), 'PUBLIC') as roles,
               pol.polpermissive                       as permissive,
               btrim(regexp_replace(coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''),
                                    '\s+', ' ', 'g'))       as qual,
               btrim(regexp_replace(coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''),
                                    '\s+', ' ', 'g'))       as with_check
        from pg_policy pol
        join pg_class c on c.oid = pol.polrelid
        join pg_namespace ns on ns.oid = c.relnamespace
        where (ns.nspname = 'storage' and c.relname = 'objects')
           or (ns.nspname = 'public'
               and c.relname in ('profiles', 'listings', 'listing_images', 'favorites'))
      )
      select coalesce(a.relation, e.relation)     as relation,
             coalesce(a.policyname, e.policyname) as policyname,
             case
               when a.policyname is null then 'recorded policy is missing'
               when e.policyname is null then 'policy is not in the recorded export'
               when not a.permissive then 'is RESTRICTIVE, recorded as PERMISSIVE'
               when a.cmd is distinct from e.cmd then
                 format('command %s, recorded %s', a.cmd, e.cmd)
               when a.roles is distinct from e.roles then
                 format('roles {%s}, recorded {%s}', a.roles, e.roles)
               when a.qual is distinct from e.qual then
                 format('USING %s, recorded %s', coalesce(nullif(a.qual, ''), '<null>'),
                        coalesce(nullif(e.qual, ''), '<null>'))
               when a.with_check is distinct from e.with_check then
                 format('WITH CHECK %s, recorded %s', coalesce(nullif(a.with_check, ''), '<null>'),
                        coalesce(nullif(e.with_check, ''), '<null>'))
               else null
             end as problem
      from actual a
      full outer join expected e
        on e.relation = a.relation and e.policyname = a.policyname
      order by 1, 2
    loop
      if rec.problem is not null then
        blocked := blocked || format('%s.%s: %s', rec.relation, rec.policyname, rec.problem);
      end if;
    end loop;

    -------------------------------------------------------------------------
    -- 3.2 The listing-images bucket, as recorded. avif_autodetection is not
    --     part of the export and is not part of the canonical contract either,
    --     so it is neither checked nor written.
    -------------------------------------------------------------------------
    for rec in
      select b.id, b.public, b.file_size_limit, b.allowed_mime_types
      from storage.buckets b
    loop
      if rec.id <> 'listing-images' then
        blocked := blocked || format('storage.buckets: unrecorded bucket %L exists', rec.id);
      elsif rec.public is distinct from true
         or rec.file_size_limit is distinct from 10485760
         or rec.allowed_mime_types is distinct from array['image/jpeg', 'image/png', 'image/webp'] then
        blocked := blocked || format(
          'storage.buckets.listing-images: public=%s, file_size_limit=%s, allowed_mime_types=%s; recorded true / 10485760 / {image/jpeg,image/png,image/webp}',
          rec.public, rec.file_size_limit, rec.allowed_mime_types);
      end if;
    end loop;

    if not exists (select 1 from storage.buckets where id = 'listing-images') then
      blocked := blocked || 'storage.buckets: the listing-images bucket is missing';
    end if;

    -------------------------------------------------------------------------
    -- 3.3 The signup trigger on auth.users, matched structurally rather than
    --     by the deparsed CREATE TRIGGER text, and its function matched on
    --     body, security and search_path.
    -------------------------------------------------------------------------
    for rec in
      select tg.tgname::text as name,
             tg.tgtype,
             tg.tgenabled,
             tg.tgqual is not null as has_when,
             (pr.pronamespace::regnamespace::text || '.' || pr.proname::text) as func,
             pr.prosecdef,
             l.lanname::text as lang,
             pg_get_function_identity_arguments(pr.oid) as args,
             pr.prorettype::regtype::text as rettype,
             coalesce(array_to_string(pr.proconfig, ','), '') as config,
             replace(pr.prosrc, chr(13) || chr(10), chr(10)) as src
      from pg_trigger tg
      join pg_proc pr on pr.oid = tg.tgfoid
      join pg_language l on l.oid = pr.prolang
      where tg.tgrelid = 'auth.users'::regclass
        and not tg.tgisinternal
    loop
      if rec.name <> legacy_trigger_name then
        blocked := blocked || format('auth.users: unrecorded trigger %L calling %s', rec.name, rec.func);
      elsif rec.func <> legacy_trigger_func then
        blocked := blocked || format('auth.users.%s calls %s, recorded %s', rec.name, rec.func, legacy_trigger_func);
      elsif rec.tgtype <> legacy_trigger_type then
        blocked := blocked || format('auth.users.%s has tgtype %s, recorded %s (AFTER INSERT FOR EACH ROW)',
                                     rec.name, rec.tgtype, legacy_trigger_type);
      elsif rec.has_when then
        blocked := blocked || format('auth.users.%s carries a WHEN clause, which the export does not record', rec.name);
      elsif rec.tgenabled <> 'O' then
        blocked := blocked || format('auth.users.%s is in state %L, recorded %L', rec.name, rec.tgenabled, 'O');
      elsif rec.lang <> legacy_func_lang or rec.args <> legacy_func_args
            or rec.rettype <> legacy_func_rettype then
        blocked := blocked || format('%s: %s(%s) returns %s; recorded %s() returns %s',
                                     rec.func, rec.lang, rec.args, rec.rettype,
                                     legacy_func_lang, legacy_func_rettype);
      elsif not rec.prosecdef or rec.config <> 'search_path=""' then
        blocked := blocked || format('%s: security definer %s, config {%s}; recorded true / {search_path=""}',
                                     rec.func, rec.prosecdef, rec.config);
      elsif rec.src <> legacy_func_src then
        -- Verbatim, CRLF folded to LF only: whitespace normalisation would let a
        -- body whose statements were moved onto a comment line compare equal.
        blocked := blocked || format('%s body differs from the recorded one.%s',
                                     rec.func,
                                     format(E'\n      actual  :%s\n      recorded:%s', rec.src, legacy_func_src));
      end if;
    end loop;

    select count(*) into n
    from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
    if n <> 1 then
      blocked := blocked || format('auth.users carries %s user triggers; the export records exactly 1', n);
    end if;

    -------------------------------------------------------------------------
    -- 3.4 Nothing in public outside the known legacy inventory, and nothing
    --     outside the drop set referencing it.
    -------------------------------------------------------------------------
    select coalesce(array_agg(r order by r), '{}') into unexpected
    from unnest(rels) as r
    where r not in ('profiles', 'listings', 'listing_images', 'favorites');

    if array_length(unexpected, 1) is not null then
      blocked := blocked || format('schema public holds unexpected relation(s): %s',
                                   array_to_string(unexpected, ', '));
    end if;

    select coalesce(array_agg(format('%s.%s -> %s', src_ns, src_tbl, tgt_tbl) order by src_tbl), '{}')
      into dependants
    from (
      select sn.nspname::text as src_ns, sc.relname::text as src_tbl, tc.relname::text as tgt_tbl
      from pg_constraint con
      join pg_class sc on sc.oid = con.conrelid
      join pg_namespace sn on sn.oid = sc.relnamespace
      join pg_class tc on tc.oid = con.confrelid
      join pg_namespace tn on tn.oid = tc.relnamespace
      where con.contype = 'f'
        and tn.nspname = 'public'
        and tc.relname in ('profiles', 'listings', 'listing_images', 'favorites')
        and not (sn.nspname = 'public'
                 and sc.relname in ('profiles', 'listings', 'listing_images', 'favorites'))
    ) fk;

    if array_length(dependants, 1) is not null then
      blocked := blocked || format('foreign keys from outside the drop set: %s',
                                   array_to_string(dependants, ', '));
    end if;

    if array_length(blocked, 1) is not null then
      raise exception 'RATATAI reconcile: BLOCKED before any change.%',
        format(E'\n  - %s', array_to_string(blocked, E'\n  - '))
        using errcode = 'raise_exception';
    end if;

    -------------------------------------------------------------------------
    -- 3.5 Locks first, counts second. ACCESS EXCLUSIVE on the tables that are
    --     about to go and SHARE on storage.objects (blocks writers, leaves
    --     readers alone); both held until commit.
    -------------------------------------------------------------------------
    lock table public.listings, public.listing_images, public.favorites,
               public.profiles in access exclusive mode;
    lock table storage.objects in share mode;

    foreach enum_name in array array['listings', 'listing_images', 'favorites'] loop
      execute format('select count(*) from public.%I', enum_name) into n;
      if n <> 0 then
        raise exception 'RATATAI reconcile: public.% holds % row(s); refusing to drop it. Nothing was changed.', enum_name, n
          using errcode = 'raise_exception';
      end if;
    end loop;

    select count(*) into n from storage.objects where bucket_id = 'listing-images';
    if n <> 0 then
      raise exception 'RATATAI reconcile: the listing-images bucket holds % object(s); refusing to reset its policies. Nothing was changed.', n
        using errcode = 'raise_exception';
    end if;

    -------------------------------------------------------------------------
    -- 3.6 Profiles into a temporary table for the length of the transaction.
    --     Nothing is archived into schema public.
    -------------------------------------------------------------------------
    select count(*) into profiles_before from public.profiles;

    select count(*) into n
    from public.profiles p
    where not exists (select 1 from auth.users u where u.id = p.id);
    if n <> 0 then
      raise exception 'RATATAI reconcile: % profile row(s) have no auth.users row and could not be restored. Nothing was changed.', n
        using errcode = 'raise_exception';
    end if;

    create temporary table reconcile_profiles_snapshot on commit drop as
      select * from public.profiles;

    select coalesce(array_agg(a.attname::text), '{}')
      into snapshot_cols
    from pg_attribute a
    where a.attrelid = 'pg_temp.reconcile_profiles_snapshot'::regclass
      and a.attnum > 0 and not a.attisdropped;

    select coalesce(array_agg(c order by c), '{}')
      into missing_cols
    from unnest(array['id', 'full_name', 'username', 'phone', 'city',
                      'avatar_url', 'created_at', 'updated_at']) as c
    where c <> all(snapshot_cols);

    if array_length(missing_cols, 1) is not null then
      raise exception 'RATATAI reconcile: legacy profiles lacks the column(s) %; the required fields cannot be preserved. Nothing was changed.',
        array_to_string(missing_cols, ', ')
        using errcode = 'raise_exception';
    end if;

    select count(*) into n from reconcile_profiles_snapshot;
    if n <> profiles_before then
      raise exception 'RATATAI reconcile: snapshot holds % of % profile row(s).', n, profiles_before
        using errcode = 'raise_exception';
    end if;

    -------------------------------------------------------------------------
    -- 3.7 Drop the legacy shape. Foreign-key order, never CASCADE.
    -------------------------------------------------------------------------
    execute format('drop trigger %I on auth.users', legacy_trigger_name);

    -- The policies go first and by name. A policy whose expression reads
    -- another table registers a dependency on it (profiles_select_active_seller
    -- reads listings), so dropping the tables while the policies stand would
    -- either fail or need a CASCADE. Every one of these was matched against the
    -- recorded export in 3.1 before this point was reached.
    for rec in
      select (ns.nspname || '.' || c.relname) as relation, pol.polname::text as name
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname in ('profiles', 'listings', 'listing_images', 'favorites')
      order by 1, 2
    loop
      execute format('drop policy %I on %s', rec.name, rec.relation);
    end loop;

    drop table public.favorites;
    drop table public.listing_images;
    drop table public.listings;
    drop table public.profiles;

    foreach enum_name in array array['category_type', 'listing_status'] loop
      select coalesce(array_agg(pg_describe_object(d.classid, d.objid, d.objsubid)), '{}')
        into dependants
      from pg_depend d
      where d.refobjid = format('public.%I', enum_name)::regtype::oid
        and d.deptype <> 'i'
        and d.classid <> 'pg_type'::regclass;

      if array_length(dependants, 1) is not null then
        raise exception
          'RATATAI reconcile: enum public.% still has dependants: %. Nothing was dropped with CASCADE; rolling back.',
          enum_name, array_to_string(dependants, ', ')
          using errcode = 'raise_exception';
      end if;

      execute format('drop type public.%I', enum_name);
    end loop;

    -------------------------------------------------------------------------
    -- 3.8 Canonical schema — the contract of 001 and 002, verbatim.
    -------------------------------------------------------------------------
    execute 'create extension if not exists pgcrypto';

    execute $ddl$
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
    $ddl$;

    execute $ddl$
create or replace function public.set_published_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  -- Stamp the first transition into the public catalog and never clear it,
  -- so that a listing which is sold and re-activated keeps its original date.
  if new.status = 'active' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;
    $ddl$;

    execute $ddl$
      create table public.profiles (
        id uuid primary key references auth.users (id) on delete cascade,
        display_name text,
        phone text,
        phone_is_public boolean not null default true,
        preferred_language text not null default 'lt'
          check (preferred_language in ('lt', 'ru', 'en')),
        city text,
        avatar_url text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $ddl$;

    execute $ddl$
      create trigger profiles_set_updated_at
        before update on public.profiles
        for each row execute function public.set_updated_at()
    $ddl$;

    execute $ddl$
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'preferred_language', '')), ''),
      'lt'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
    $ddl$;

    execute $ddl$
      create trigger on_auth_user_created
        after insert on auth.users
        for each row execute function public.handle_new_user()
    $ddl$;

    execute $ddl$
      create table public.listings (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.profiles (id) on delete cascade,
        category text not null
          check (category in ('padangos', 'ratlankiai', 'komplektiniai_ratai')),
        title text not null check (length(btrim(title)) between 3 and 140),
        description text not null check (length(btrim(description)) between 10 and 5000),
        condition text not null check (condition in ('new', 'used')),
        price numeric(12, 2) not null check (price >= 0),
        currency text not null default 'EUR' check (currency = 'EUR'),
        quantity integer not null check (quantity > 0 and quantity <= 100),
        country text not null default 'LT' check (length(country) = 2),
        city text not null check (length(btrim(city)) > 0),
        area text,
        specs jsonb not null
          check (jsonb_typeof(specs) = 'object' and specs <> '{}'::jsonb),
        status text not null default 'draft'
          check (status in ('draft', 'active', 'sold', 'archived')),
        moderation_status text not null default 'approved'
          check (moderation_status in ('pending', 'approved', 'rejected')),
        slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        published_at timestamptz
      )
    $ddl$;

    execute $ddl$
      create trigger listings_set_updated_at
        before update on public.listings
        for each row execute function public.set_updated_at()
    $ddl$;

    execute $ddl$
      create trigger listings_set_published_at
        before insert or update on public.listings
        for each row execute function public.set_published_at()
    $ddl$;

    execute $ddl$
      create index listings_public_created_at_idx on public.listings (created_at desc)
        where status = 'active' and moderation_status = 'approved'
    $ddl$;
    execute $ddl$
      create index listings_public_price_idx on public.listings (price)
        where status = 'active' and moderation_status = 'approved'
    $ddl$;
    execute 'create index listings_category_created_at_idx on public.listings (category, created_at desc)';
    execute 'create index listings_user_id_created_at_idx on public.listings (user_id, created_at desc)';
    execute 'create index listings_specs_gin_idx on public.listings using gin (specs jsonb_path_ops)';
    execute 'create index listings_title_trgm_idx on public.listings (lower(title) text_pattern_ops)';

    execute $ddl$
      create table public.listing_images (
        id uuid primary key default gen_random_uuid(),
        listing_id uuid not null references public.listings (id) on delete cascade,
        storage_path text not null unique,
        public_url text not null,
        position integer not null default 0 check (position >= 0 and position < 10),
        is_primary boolean not null default false,
        created_at timestamptz not null default now()
      )
    $ddl$;

    execute $ddl$
      create index listing_images_listing_position_idx
        on public.listing_images (listing_id, position, created_at)
    $ddl$;
    execute $ddl$
      create unique index listing_images_one_primary_idx
        on public.listing_images (listing_id) where is_primary
    $ddl$;

    execute $ddl$
create or replace function public.enforce_listing_image_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  image_count integer;
begin
  select count(*) into image_count
  from public.listing_images
  where listing_id = new.listing_id;

  if image_count >= 10 then
    raise exception 'listing % already has the maximum of 10 images', new.listing_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
    $ddl$;

    execute $ddl$
      create trigger listing_images_limit
        before insert on public.listing_images
        for each row execute function public.enforce_listing_image_limit()
    $ddl$;

    execute $ddl$
      create or replace view public.listing_sellers as
      select
        l.id as listing_id,
        p.display_name,
        p.city,
        case when p.phone_is_public then p.phone else null end as phone
      from public.listings l
      join public.profiles p on p.id = l.user_id
      where l.status = 'active'
        and l.moderation_status = 'approved'
    $ddl$;

    execute $ddl$
      comment on view public.listing_sellers is
        'Public seller data per active listing. Never exposes email or user UUID.'
    $ddl$;

    execute 'alter table public.profiles enable row level security';
    execute 'alter table public.listings enable row level security';
    execute 'alter table public.listing_images enable row level security';
    execute 'alter table public.profiles force row level security';

    execute $ddl$
      create policy "profiles_select_own" on public.profiles for select
        to authenticated using (auth.uid() = id)
    $ddl$;
    execute $ddl$
      create policy "profiles_insert_own" on public.profiles for insert
        to authenticated with check (auth.uid() = id)
    $ddl$;
    execute $ddl$
      create policy "profiles_update_own" on public.profiles for update
        to authenticated using (auth.uid() = id) with check (auth.uid() = id)
    $ddl$;

    execute $ddl$
      create policy "listings_select_public" on public.listings for select
        to anon, authenticated
        using (status = 'active' and moderation_status = 'approved')
    $ddl$;
    execute $ddl$
      create policy "listings_select_own" on public.listings for select
        to authenticated using (auth.uid() = user_id)
    $ddl$;
    execute $ddl$
      create policy "listings_insert_own" on public.listings for insert
        to authenticated with check (auth.uid() = user_id)
    $ddl$;
    execute $ddl$
      create policy "listings_update_own" on public.listings for update
        to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $ddl$;
    execute $ddl$
      create policy "listings_delete_own" on public.listings for delete
        to authenticated using (auth.uid() = user_id)
    $ddl$;

    execute $ddl$
      create policy "listing_images_select_public" on public.listing_images for select
        to anon, authenticated
        using (exists (select 1 from public.listings l
                       where l.id = listing_images.listing_id
                         and l.status = 'active'
                         and l.moderation_status = 'approved'))
    $ddl$;
    execute $ddl$
      create policy "listing_images_select_own" on public.listing_images for select
        to authenticated
        using (exists (select 1 from public.listings l
                       where l.id = listing_images.listing_id and l.user_id = auth.uid()))
    $ddl$;
    execute $ddl$
      create policy "listing_images_insert_own" on public.listing_images for insert
        to authenticated
        with check (exists (select 1 from public.listings l
                            where l.id = listing_images.listing_id and l.user_id = auth.uid()))
    $ddl$;
    execute $ddl$
      create policy "listing_images_update_own" on public.listing_images for update
        to authenticated
        using (exists (select 1 from public.listings l
                       where l.id = listing_images.listing_id and l.user_id = auth.uid()))
        with check (exists (select 1 from public.listings l
                            where l.id = listing_images.listing_id and l.user_id = auth.uid()))
    $ddl$;
    execute $ddl$
      create policy "listing_images_delete_own" on public.listing_images for delete
        to authenticated
        using (exists (select 1 from public.listings l
                       where l.id = listing_images.listing_id and l.user_id = auth.uid()))
    $ddl$;

    execute 'grant select on public.listing_sellers to anon, authenticated';

    execute $ddl$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('listing-images', 'listing-images', true, 10485760,
              array['image/jpeg', 'image/png', 'image/webp'])
      on conflict (id) do update
      set public = excluded.public,
          file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types
    $ddl$;

    -- The four legacy Storage policies, whose exact definitions were verified
    -- in 3.1, make way for the canonical four.
    execute 'drop policy "storage_listing_images_select_public" on storage.objects';
    execute 'drop policy "storage_listing_images_insert_own" on storage.objects';
    execute 'drop policy "storage_listing_images_update_own" on storage.objects';
    execute 'drop policy "storage_listing_images_delete_own" on storage.objects';

    execute $ddl$
      create policy "listing_images_storage_select" on storage.objects for select
        to anon, authenticated using (bucket_id = 'listing-images')
    $ddl$;
    execute $ddl$
      create policy "listing_images_storage_insert_own" on storage.objects for insert
        to authenticated
        with check (
          bucket_id = 'listing-images'
          and (storage.foldername(name))[1] = auth.uid()::text
          and exists (select 1 from public.listings l
                      where l.id::text = (storage.foldername(name))[2]
                        and l.user_id = auth.uid())
        )
    $ddl$;
    execute $ddl$
      create policy "listing_images_storage_update_own" on storage.objects for update
        to authenticated
        using (bucket_id = 'listing-images'
               and (storage.foldername(name))[1] = auth.uid()::text)
        with check (bucket_id = 'listing-images'
                    and (storage.foldername(name))[1] = auth.uid()::text)
    $ddl$;
    execute $ddl$
      create policy "listing_images_storage_delete_own" on storage.objects for delete
        to authenticated
        using (bucket_id = 'listing-images'
               and (storage.foldername(name))[1] = auth.uid()::text)
    $ddl$;

    -------------------------------------------------------------------------
    -- 3.9 Restore the profiles, then prove that every required field survived.
    --
    --     phone_is_public is deliberately left out of the column list so the
    --     canonical default and its semantics apply, rather than a value
    --     invented from a legacy column that means something else.
    -------------------------------------------------------------------------
    display_expr := 'coalesce(nullif(btrim(full_name), ''''), nullif(btrim(username), ''''))';
    col_list := 'id, display_name, preferred_language, phone, city, avatar_url, created_at, updated_at';
    val_list := format('id, %s, ''lt'', phone, city, avatar_url, created_at, updated_at', display_expr);

    execute format('insert into public.profiles (%s) select %s from reconcile_profiles_snapshot',
                   col_list, val_list);

    select count(*) into n from public.profiles;
    if n <> profiles_before then
      raise exception 'RATATAI reconcile: % profile(s) restored out of %.', n, profiles_before
        using errcode = 'raise_exception';
    end if;

    select count(*) into n
    from reconcile_profiles_snapshot s
    where not exists (select 1 from public.profiles p where p.id = s.id);
    if n <> 0 then
      raise exception 'RATATAI reconcile: % profile id(s) did not survive the conversion.', n
        using errcode = 'raise_exception';
    end if;

    select count(*) into n
    from reconcile_profiles_snapshot s
    join public.profiles p on p.id = s.id
    where p.phone       is distinct from s.phone
       or p.city        is distinct from s.city
       or p.avatar_url  is distinct from s.avatar_url
       or p.created_at  is distinct from s.created_at
       or p.updated_at  is distinct from s.updated_at
       or p.display_name is distinct from coalesce(nullif(btrim(s.full_name), ''),
                                                   nullif(btrim(s.username), ''))
       or p.preferred_language <> 'lt'
       or p.phone_is_public <> true;

    if n <> 0 then
      raise exception 'RATATAI reconcile: % restored profile(s) do not match the snapshot (id, phone, city, avatar_url, created_at, updated_at, display_name, preferred_language, phone_is_public).', n
        using errcode = 'raise_exception';
    end if;
  else
    raise notice 'RATATAI reconcile: schema is already canonical; verifying conformance, writing nothing.';
  end if;

  ---------------------------------------------------------------------------
  -- 4. Conformance with 001 + 002. Runs on both paths: on the canonical path
  --    it is the whole of the migration, on the legacy path it is the
  --    post-condition. Every expected value was read out of a database built
  --    from the real 001 and 002.
  ---------------------------------------------------------------------------
  blocked := '{}';

  -- 4.1 relations
  foreach enum_name in array array['profiles', 'listings', 'listing_images'] loop
    if to_regclass('public.' || enum_name) is null then
      blocked := blocked || format('table public.%s is missing', enum_name);
    end if;
  end loop;
  if not exists (
    select 1 from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname = 'listing_sellers' and c.relkind = 'v'
  ) then
    blocked := blocked || 'view public.listing_sellers is missing';
  end if;

  -- 4.2 columns: type, nullability, default, numeric precision and scale,
  --     identity and generated. Defaults are compared with a leading
  --     `extensions.` qualifier stripped from both sides: a Supabase project
  --     installs pgcrypto into the extensions schema, so gen_random_uuid() can
  --     deparse either way without any difference in meaning.
  for rec in
    with expected(t, c, ty, nullable, dflt, numscale, identity, generated) as (
      values
        ('listing_images', 'id', 'uuid', 'NO', 'gen_random_uuid()', '/', 'NO', 'NEVER'),
        ('listing_images', 'listing_id', 'uuid', 'NO', '', '/', 'NO', 'NEVER'),
        ('listing_images', 'storage_path', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listing_images', 'public_url', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listing_images', 'position', 'integer', 'NO', '0', '32/0', 'NO', 'NEVER'),
        ('listing_images', 'is_primary', 'boolean', 'NO', 'false', '/', 'NO', 'NEVER'),
        ('listing_images', 'created_at', 'timestamp with time zone', 'NO', 'now()', '/', 'NO', 'NEVER'),
        ('listings', 'id', 'uuid', 'NO', 'gen_random_uuid()', '/', 'NO', 'NEVER'),
        ('listings', 'user_id', 'uuid', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'category', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'title', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'description', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'condition', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'price', 'numeric', 'NO', '', '12/2', 'NO', 'NEVER'),
        ('listings', 'currency', 'text', 'NO', '''EUR''::text', '/', 'NO', 'NEVER'),
        ('listings', 'quantity', 'integer', 'NO', '', '32/0', 'NO', 'NEVER'),
        ('listings', 'country', 'text', 'NO', '''LT''::text', '/', 'NO', 'NEVER'),
        ('listings', 'city', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'area', 'text', 'YES', '', '/', 'NO', 'NEVER'),
        ('listings', 'specs', 'jsonb', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'status', 'text', 'NO', '''draft''::text', '/', 'NO', 'NEVER'),
        ('listings', 'moderation_status', 'text', 'NO', '''approved''::text', '/', 'NO', 'NEVER'),
        ('listings', 'slug', 'text', 'NO', '', '/', 'NO', 'NEVER'),
        ('listings', 'created_at', 'timestamp with time zone', 'NO', 'now()', '/', 'NO', 'NEVER'),
        ('listings', 'updated_at', 'timestamp with time zone', 'NO', 'now()', '/', 'NO', 'NEVER'),
        ('listings', 'published_at', 'timestamp with time zone', 'YES', '', '/', 'NO', 'NEVER'),
        ('profiles', 'id', 'uuid', 'NO', '', '/', 'NO', 'NEVER'),
        ('profiles', 'display_name', 'text', 'YES', '', '/', 'NO', 'NEVER'),
        ('profiles', 'phone', 'text', 'YES', '', '/', 'NO', 'NEVER'),
        ('profiles', 'phone_is_public', 'boolean', 'NO', 'true', '/', 'NO', 'NEVER'),
        ('profiles', 'preferred_language', 'text', 'NO', '''lt''::text', '/', 'NO', 'NEVER'),
        ('profiles', 'city', 'text', 'YES', '', '/', 'NO', 'NEVER'),
        ('profiles', 'avatar_url', 'text', 'YES', '', '/', 'NO', 'NEVER'),
        ('profiles', 'created_at', 'timestamp with time zone', 'NO', 'now()', '/', 'NO', 'NEVER'),
        ('profiles', 'updated_at', 'timestamp with time zone', 'NO', 'now()', '/', 'NO', 'NEVER')
    ),
    actual as (
      select table_name::text as t, column_name::text as c, data_type::text as ty,
             is_nullable::text as nullable,
             replace(coalesce(column_default, ''), 'extensions.', '') as dflt,
             coalesce(numeric_precision::text, '') || '/' || coalesce(numeric_scale::text, '') as numscale,
             is_identity::text as identity, is_generated::text as generated
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('profiles', 'listings', 'listing_images')
    )
    select coalesce(a.t, e.t) as t, coalesce(a.c, e.c) as c,
           case
             when a.c is null then 'column is missing'
             when e.c is null then 'column is not part of the canonical contract'
             when a.ty is distinct from e.ty then format('type %s, canonical %s', a.ty, e.ty)
             when a.nullable is distinct from e.nullable then
               format('nullable %s, canonical %s', a.nullable, e.nullable)
             when a.dflt is distinct from e.dflt then
               format('default %s, canonical %s', coalesce(nullif(a.dflt, ''), '<none>'),
                      coalesce(nullif(e.dflt, ''), '<none>'))
             when a.numscale is distinct from e.numscale then
               format('numeric precision/scale %s, canonical %s', a.numscale, e.numscale)
             when a.identity is distinct from e.identity then
               format('identity %s, canonical %s', a.identity, e.identity)
             when a.generated is distinct from e.generated then
               format('generated %s, canonical %s', a.generated, e.generated)
             else null
           end as problem
    from actual a full outer join expected e on e.t = a.t and e.c = a.c
  loop
    if rec.problem is not null then
      blocked := blocked || format('public.%s.%s: %s', rec.t, rec.c, rec.problem);
    end if;
  end loop;

  -- 4.3 constraints: table, type, full definition, validated, deferrable and
  --     deferred. A CHECK that kept its name but changed its condition differs
  --     here even though the name still matches.
  for rec in
    with expected(t, name, contype, def, validated, deferrable_deferred) as (
      values
        ('listing_images', 'listing_images_listing_id_fkey', 'f', 'FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE', 'true', 'false/false'),
        ('listing_images', 'listing_images_pkey', 'p', 'PRIMARY KEY (id)', 'true', 'false/false'),
        ('listing_images', 'listing_images_position_check', 'c', 'CHECK ((("position" >= 0) AND ("position" < 10)))', 'true', 'false/false'),
        ('listing_images', 'listing_images_storage_path_key', 'u', 'UNIQUE (storage_path)', 'true', 'false/false'),
        ('listings', 'listings_category_check', 'c', 'CHECK ((category = ANY (ARRAY[''padangos''::text, ''ratlankiai''::text, ''komplektiniai_ratai''::text])))', 'true', 'false/false'),
        ('listings', 'listings_city_check', 'c', 'CHECK ((length(btrim(city)) > 0))', 'true', 'false/false'),
        ('listings', 'listings_condition_check', 'c', 'CHECK ((condition = ANY (ARRAY[''new''::text, ''used''::text])))', 'true', 'false/false'),
        ('listings', 'listings_country_check', 'c', 'CHECK ((length(country) = 2))', 'true', 'false/false'),
        ('listings', 'listings_currency_check', 'c', 'CHECK ((currency = ''EUR''::text))', 'true', 'false/false'),
        ('listings', 'listings_description_check', 'c', 'CHECK (((length(btrim(description)) >= 10) AND (length(btrim(description)) <= 5000)))', 'true', 'false/false'),
        ('listings', 'listings_moderation_status_check', 'c', 'CHECK ((moderation_status = ANY (ARRAY[''pending''::text, ''approved''::text, ''rejected''::text])))', 'true', 'false/false'),
        ('listings', 'listings_pkey', 'p', 'PRIMARY KEY (id)', 'true', 'false/false'),
        ('listings', 'listings_price_check', 'c', 'CHECK ((price >= (0)::numeric))', 'true', 'false/false'),
        ('listings', 'listings_quantity_check', 'c', 'CHECK (((quantity > 0) AND (quantity <= 100)))', 'true', 'false/false'),
        ('listings', 'listings_slug_check', 'c', 'CHECK ((slug ~ ''^[a-z0-9]+(?:-[a-z0-9]+)*$''::text))', 'true', 'false/false'),
        ('listings', 'listings_slug_key', 'u', 'UNIQUE (slug)', 'true', 'false/false'),
        ('listings', 'listings_specs_check', 'c', 'CHECK (((jsonb_typeof(specs) = ''object''::text) AND (specs <> ''{}''::jsonb)))', 'true', 'false/false'),
        ('listings', 'listings_status_check', 'c', 'CHECK ((status = ANY (ARRAY[''draft''::text, ''active''::text, ''sold''::text, ''archived''::text])))', 'true', 'false/false'),
        ('listings', 'listings_title_check', 'c', 'CHECK (((length(btrim(title)) >= 3) AND (length(btrim(title)) <= 140)))', 'true', 'false/false'),
        ('listings', 'listings_user_id_fkey', 'f', 'FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE', 'true', 'false/false'),
        ('profiles', 'profiles_id_fkey', 'f', 'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE', 'true', 'false/false'),
        ('profiles', 'profiles_pkey', 'p', 'PRIMARY KEY (id)', 'true', 'false/false'),
        ('profiles', 'profiles_preferred_language_check', 'c', 'CHECK ((preferred_language = ANY (ARRAY[''lt''::text, ''ru''::text, ''en''::text])))', 'true', 'false/false')
    ),
    actual as (
      select c.relname::text as t, con.conname::text as name, con.contype::text as contype,
             btrim(regexp_replace(pg_get_constraintdef(con.oid), '\s+', ' ', 'g')) as def,
             con.convalidated::text as validated,
             con.condeferrable::text || '/' || con.condeferred::text as deferrable_deferred
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname in ('profiles', 'listings', 'listing_images')
    )
    select coalesce(a.t, e.t) as t, coalesce(a.name, e.name) as name,
           case
             when a.name is null then 'canonical constraint is missing'
             when e.name is null then 'constraint is not part of the canonical contract'
             when a.contype is distinct from e.contype then
               format('type %s, canonical %s', a.contype, e.contype)
             when a.def is distinct from e.def then
               format('definition %s, canonical %s', a.def, e.def)
             when a.validated is distinct from e.validated then
               format('validated %s, canonical %s', a.validated, e.validated)
             when a.deferrable_deferred is distinct from e.deferrable_deferred then
               format('deferrable/deferred %s, canonical %s',
                      a.deferrable_deferred, e.deferrable_deferred)
             else null
           end as problem
    from actual a full outer join expected e on e.t = a.t and e.name = a.name
  loop
    if rec.problem is not null then
      blocked := blocked || format('constraint public.%s.%s: %s', rec.t, rec.name, rec.problem);
    end if;
  end loop;

  -- 4.4 indexes: table, full definition (which carries the expressions, the
  --     operator classes, the sort order and the partial predicate), unique,
  --     valid and ready.
  for rec in
    with expected(t, name, def, is_unique, valid_ready) as (
      values
        ('listing_images', 'listing_images_listing_position_idx', 'CREATE INDEX listing_images_listing_position_idx ON public.listing_images USING btree (listing_id, "position", created_at)', 'false', 'true/true'),
        ('listing_images', 'listing_images_one_primary_idx', 'CREATE UNIQUE INDEX listing_images_one_primary_idx ON public.listing_images USING btree (listing_id) WHERE is_primary', 'true', 'true/true'),
        ('listing_images', 'listing_images_pkey', 'CREATE UNIQUE INDEX listing_images_pkey ON public.listing_images USING btree (id)', 'true', 'true/true'),
        ('listing_images', 'listing_images_storage_path_key', 'CREATE UNIQUE INDEX listing_images_storage_path_key ON public.listing_images USING btree (storage_path)', 'true', 'true/true'),
        ('listings', 'listings_category_created_at_idx', 'CREATE INDEX listings_category_created_at_idx ON public.listings USING btree (category, created_at DESC)', 'false', 'true/true'),
        ('listings', 'listings_pkey', 'CREATE UNIQUE INDEX listings_pkey ON public.listings USING btree (id)', 'true', 'true/true'),
        ('listings', 'listings_public_created_at_idx', 'CREATE INDEX listings_public_created_at_idx ON public.listings USING btree (created_at DESC) WHERE ((status = ''active''::text) AND (moderation_status = ''approved''::text))', 'false', 'true/true'),
        ('listings', 'listings_public_price_idx', 'CREATE INDEX listings_public_price_idx ON public.listings USING btree (price) WHERE ((status = ''active''::text) AND (moderation_status = ''approved''::text))', 'false', 'true/true'),
        ('listings', 'listings_slug_key', 'CREATE UNIQUE INDEX listings_slug_key ON public.listings USING btree (slug)', 'true', 'true/true'),
        ('listings', 'listings_specs_gin_idx', 'CREATE INDEX listings_specs_gin_idx ON public.listings USING gin (specs jsonb_path_ops)', 'false', 'true/true'),
        ('listings', 'listings_title_trgm_idx', 'CREATE INDEX listings_title_trgm_idx ON public.listings USING btree (lower(title) text_pattern_ops)', 'false', 'true/true'),
        ('listings', 'listings_user_id_created_at_idx', 'CREATE INDEX listings_user_id_created_at_idx ON public.listings USING btree (user_id, created_at DESC)', 'false', 'true/true'),
        ('profiles', 'profiles_pkey', 'CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)', 'true', 'true/true')
    ),
    actual as (
      select c.relname::text as t, ic.relname::text as name,
             btrim(regexp_replace(pg_get_indexdef(i.indexrelid), '\s+', ' ', 'g')) as def,
             i.indisunique::text as is_unique,
             i.indisvalid::text || '/' || i.indisready::text as valid_ready
      from pg_index i
      join pg_class ic on ic.oid = i.indexrelid
      join pg_class c on c.oid = i.indrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where ns.nspname = 'public'
        and c.relname in ('profiles', 'listings', 'listing_images')
    )
    select coalesce(a.t, e.t) as t, coalesce(a.name, e.name) as name,
           case
             when a.name is null then 'canonical index is missing'
             when e.name is null then 'index is not part of the canonical contract'
             when a.def is distinct from e.def then
               format('definition %s, canonical %s', a.def, e.def)
             when a.is_unique is distinct from e.is_unique then
               format('unique %s, canonical %s', a.is_unique, e.is_unique)
             when a.valid_ready is distinct from e.valid_ready then
               format('valid/ready %s, canonical %s', a.valid_ready, e.valid_ready)
             else null
           end as problem
    from actual a full outer join expected e on e.t = a.t and e.name = a.name
  loop
    if rec.problem is not null then
      blocked := blocked || format('index public.%s.%s: %s', rec.t, rec.name, rec.problem);
    end if;
  end loop;

  -- 4.5 row level security
  for rec in
    select c.relname::text as name, c.relrowsecurity as enabled, c.relforcerowsecurity as forced
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relname in ('profiles', 'listings', 'listing_images')
  loop
    if not rec.enabled then
      blocked := blocked || format('public.%s: row level security is off', rec.name);
    end if;
    if (rec.name = 'profiles') <> rec.forced then
      blocked := blocked || format('public.%s: force row level security is %s, canonical %s',
                                   rec.name, rec.forced, rec.name = 'profiles');
    end if;
  end loop;

  -- 4.6 the full policy set, compared on every attribute. One policy more
  --     (a broader one, say) is as much a stop as one missing.
  for rec in
    with expected(relation, policyname, cmd, roles, qual, with_check) as (
      values
        ('public.listing_images', 'listing_images_delete_own', 'DELETE', 'authenticated',
         '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = auth.uid()))))', ''),
        ('public.listing_images', 'listing_images_insert_own', 'INSERT', 'authenticated',
         '', '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = auth.uid()))))'),
        ('public.listing_images', 'listing_images_select_own', 'SELECT', 'authenticated',
         '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = auth.uid()))))', ''),
        ('public.listing_images', 'listing_images_select_public', 'SELECT', 'anon,authenticated',
         '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.status = ''active''::text) AND (l.moderation_status = ''approved''::text))))', ''),
        ('public.listing_images', 'listing_images_update_own', 'UPDATE', 'authenticated',
         '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = auth.uid()))))',
         '(EXISTS ( SELECT 1 FROM listings l WHERE ((l.id = listing_images.listing_id) AND (l.user_id = auth.uid()))))'),
        ('public.listings', 'listings_delete_own', 'DELETE', 'authenticated',
         '(auth.uid() = user_id)', ''),
        ('public.listings', 'listings_insert_own', 'INSERT', 'authenticated',
         '', '(auth.uid() = user_id)'),
        ('public.listings', 'listings_select_own', 'SELECT', 'authenticated',
         '(auth.uid() = user_id)', ''),
        ('public.listings', 'listings_select_public', 'SELECT', 'anon,authenticated',
         '((status = ''active''::text) AND (moderation_status = ''approved''::text))', ''),
        ('public.listings', 'listings_update_own', 'UPDATE', 'authenticated',
         '(auth.uid() = user_id)', '(auth.uid() = user_id)'),
        ('public.profiles', 'profiles_insert_own', 'INSERT', 'authenticated',
         '', '(auth.uid() = id)'),
        ('public.profiles', 'profiles_select_own', 'SELECT', 'authenticated',
         '(auth.uid() = id)', ''),
        ('public.profiles', 'profiles_update_own', 'UPDATE', 'authenticated',
         '(auth.uid() = id)', '(auth.uid() = id)'),
        ('storage.objects', 'listing_images_storage_delete_own', 'DELETE', 'authenticated',
         '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))', ''),
        ('storage.objects', 'listing_images_storage_insert_own', 'INSERT', 'authenticated',
         '', '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1 FROM listings l WHERE (((l.id)::text = (storage.foldername(objects.name))[2]) AND (l.user_id = auth.uid())))))'),
        ('storage.objects', 'listing_images_storage_select', 'SELECT', 'anon,authenticated',
         '(bucket_id = ''listing-images''::text)', ''),
        ('storage.objects', 'listing_images_storage_update_own', 'UPDATE', 'authenticated',
         '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))',
         '((bucket_id = ''listing-images''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))')
    ),
    actual as (
      select (ns.nspname || '.' || c.relname)::text as relation,
             pol.polname::text as policyname,
             case pol.polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                             when 'w' then 'UPDATE' when 'd' then 'DELETE'
                             else 'ALL' end as cmd,
             coalesce((select string_agg(r.rolname::text, ',' order by r.rolname)
                       from pg_roles r where r.oid = any(pol.polroles)), 'PUBLIC') as roles,
             pol.polpermissive as permissive,
             btrim(regexp_replace(coalesce(pg_get_expr(pol.polqual, pol.polrelid), ''),
                                  '\s+', ' ', 'g')) as qual,
             btrim(regexp_replace(coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), ''),
                                  '\s+', ' ', 'g')) as with_check
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where (ns.nspname = 'storage' and c.relname = 'objects')
         or (ns.nspname = 'public'
             and c.relname in ('profiles', 'listings', 'listing_images', 'favorites'))
    )
    select coalesce(a.relation, e.relation) as relation,
           coalesce(a.policyname, e.policyname) as policyname,
           case
             when a.policyname is null then 'canonical policy is missing'
             when e.policyname is null then 'policy is not part of the canonical contract'
             when not a.permissive then 'is RESTRICTIVE, canonical is PERMISSIVE'
             when a.cmd is distinct from e.cmd then format('command %s, canonical %s', a.cmd, e.cmd)
             when a.roles is distinct from e.roles then
               format('roles {%s}, canonical {%s}', a.roles, e.roles)
             when a.qual is distinct from e.qual then
               format('USING %s, canonical %s', coalesce(nullif(a.qual, ''), '<null>'),
                      coalesce(nullif(e.qual, ''), '<null>'))
             when a.with_check is distinct from e.with_check then
               format('WITH CHECK %s, canonical %s', coalesce(nullif(a.with_check, ''), '<null>'),
                      coalesce(nullif(e.with_check, ''), '<null>'))
             else null
           end as problem
    from actual a full outer join expected e
      on e.relation = a.relation and e.policyname = a.policyname
    order by 1, 2
  loop
    if rec.problem is not null then
      blocked := blocked || format('%s.%s: %s', rec.relation, rec.policyname, rec.problem);
    end if;
  end loop;

  -- 4.7 triggers: state, timing and events, WHEN clause, arguments and the
  --     function each one calls. A disabled trigger differs from an enabled
  --     one even though both still exist under the same name.
  for rec in
    with expected(t, name, enabled, def, nargs, when_expr) as (
      values
        ('listing_images', 'listing_images_limit', 'O', 'CREATE TRIGGER listing_images_limit BEFORE INSERT ON public.listing_images FOR EACH ROW EXECUTE FUNCTION enforce_listing_image_limit()', '0', ''),
        ('listings', 'listings_set_published_at', 'O', 'CREATE TRIGGER listings_set_published_at BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION set_published_at()', '0', ''),
        ('listings', 'listings_set_updated_at', 'O', 'CREATE TRIGGER listings_set_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION set_updated_at()', '0', ''),
        ('profiles', 'profiles_set_updated_at', 'O', 'CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at()', '0', ''),
        ('users', 'on_auth_user_created', 'O', 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()', '0', '')
    ),
    actual as (
      select c.relname::text as t, tg.tgname::text as name, tg.tgenabled::text as enabled,
             btrim(regexp_replace(pg_get_triggerdef(tg.oid), '\s+', ' ', 'g')) as def,
             tg.tgnargs::text as nargs,
             btrim(regexp_replace(coalesce(pg_get_expr(tg.tgqual, tg.tgrelid), ''),
                                  '\s+', ' ', 'g')) as when_expr
      from pg_trigger tg
      join pg_class c on c.oid = tg.tgrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      where not tg.tgisinternal
        and ((ns.nspname = 'public' and c.relname in ('profiles', 'listings', 'listing_images'))
             or (ns.nspname = 'auth' and c.relname = 'users'))
    )
    select coalesce(a.t, e.t) as t, coalesce(a.name, e.name) as name,
           case
             when a.name is null then 'canonical trigger is missing'
             when e.name is null then 'trigger is not part of the canonical contract'
             when a.enabled is distinct from e.enabled then
               format('state %L, canonical %L (O = enabled)', a.enabled, e.enabled)
             when a.def is distinct from e.def then
               format('definition %s, canonical %s', a.def, e.def)
             when a.nargs is distinct from e.nargs then
               format('%s argument(s), canonical %s', a.nargs, e.nargs)
             when a.when_expr is distinct from e.when_expr then
               format('WHEN %s, canonical %s', coalesce(nullif(a.when_expr, ''), '<none>'),
                      coalesce(nullif(e.when_expr, ''), '<none>'))
             else null
           end as problem
    from actual a full outer join expected e on e.t = a.t and e.name = a.name
  loop
    if rec.problem is not null then
      blocked := blocked || format('trigger %s on %s: %s', rec.name, rec.t, rec.problem);
    end if;
  end loop;

  -- 4.8 exactly one signup trigger on auth.users. 4.7 has already checked that
  --     it is the canonical one; this guards against a second one beside it.
  select count(*) into n from pg_trigger
  where tgrelid = 'auth.users'::regclass and not tgisinternal;
  if n <> 1 then
    blocked := blocked || format('auth.users carries %s user trigger(s); the canonical contract has exactly 1', n);
  end if;

  -- 4.9 the canonical functions: full body, language, identity arguments,
  --     return type, SECURITY DEFINER/INVOKER, search_path and volatility.
  --
  --     The body is compared verbatim, with only CRLF folded to LF. It must not
  --     be whitespace-normalised: collapsing newlines would fold the code that
  --     follows a `--` comment onto the comment's own line, so a body that had
  --     been commented out would still compare equal. set_published_at carries
  --     exactly such a comment above its IF.
  for rec in
    with expected(name, secdef, config, volatility, lang, args, rettype, src) as (
      values
        ('enforce_listing_image_limit', 'false', 'search_path=public, pg_temp', 'v', 'plpgsql', '', 'trigger', '
declare
  image_count integer;
begin
  select count(*) into image_count
  from public.listing_images
  where listing_id = new.listing_id;

  if image_count >= 10 then
    raise exception ''listing % already has the maximum of 10 images'', new.listing_id
      using errcode = ''check_violation'';
  end if;

  return new;
end;
'),
        ('handle_new_user', 'true', 'search_path=public, pg_temp', 'v', 'plpgsql', '', 'trigger', '
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> ''display_name'', '''')), ''''),
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> ''preferred_language'', '''')), ''''),
      ''lt''
    )
  )
  on conflict (id) do nothing;

  return new;
end;
'),
        ('set_published_at', 'false', 'search_path=public, pg_temp', 'v', 'plpgsql', '', 'trigger', '
begin
  -- Stamp the first transition into the public catalog and never clear it,
  -- so that a listing which is sold and re-activated keeps its original date.
  if new.status = ''active'' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
'),
        ('set_updated_at', 'false', 'search_path=public, pg_temp', 'v', 'plpgsql', '', 'trigger', '
begin
  new.updated_at := now();
  return new;
end;
')
    ),
    actual as (
      select p.proname::text as name, p.prosecdef::text as secdef,
             coalesce(array_to_string(p.proconfig, ','), '') as config,
             p.provolatile::text as volatility,
             l.lanname::text as lang,
             pg_get_function_identity_arguments(p.oid) as args,
             p.prorettype::regtype::text as rettype,
             replace(p.prosrc, chr(13) || chr(10), chr(10)) as src
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where ns.nspname = 'public'
        and p.proname in ('set_updated_at', 'set_published_at',
                          'handle_new_user', 'enforce_listing_image_limit')
    )
    select coalesce(a.name, e.name) as name,
           case
             when a.name is null then 'canonical function is missing'
             when e.name is null then 'function is not part of the canonical contract'
             when a.lang is distinct from e.lang then
               format('language %s, canonical %s', a.lang, e.lang)
             when a.args is distinct from e.args then
               format('arguments (%s), canonical (%s)', a.args, e.args)
             when a.rettype is distinct from e.rettype then
               format('returns %s, canonical %s', a.rettype, e.rettype)
             when a.secdef is distinct from e.secdef then
               format('security definer %s, canonical %s', a.secdef, e.secdef)
             when a.config is distinct from e.config then
               format('settings {%s}, canonical {%s}', a.config, e.config)
             when a.volatility is distinct from e.volatility then
               format('volatility %s, canonical %s', a.volatility, e.volatility)
             when a.src is distinct from e.src then
               format('body differs.%s',
                      format(E'\n      actual   :%s\n      canonical:%s', a.src, e.src))
             else null
           end as problem
    from actual a full outer join expected e on e.name = a.name
  loop
    if rec.problem is not null then
      blocked := blocked || format('function public.%s: %s', rec.name, rec.problem);
    end if;
  end loop;

  -- 4.10 listing_sellers: the definition itself (a view that stopped hiding a
  --      private phone number differs here), its columns, its security options
  --      and the read access 002 grants.
  if to_regclass('public.listing_sellers') is not null then
    select btrim(regexp_replace(pg_get_viewdef('public.listing_sellers'::regclass, true),
                                '\s+', ' ', 'g'))
      into view_def;

    if view_def is distinct from canonical_view_def then
      blocked := blocked || format('view public.listing_sellers: definition differs.%s',
        format(E'\n      actual   : %s\n      canonical: %s', view_def, canonical_view_def));
    end if;

    select coalesce(array_to_string(c.reloptions, ','), '') into view_opts
    from pg_class c where c.oid = 'public.listing_sellers'::regclass;
    if view_opts <> '' then
      blocked := blocked || format('view public.listing_sellers: reloptions {%s}; the canonical view carries none, so it runs with the definer semantics 001 relies on',
                                   view_opts);
    end if;

    select coalesce(string_agg(column_name || ':' || data_type, ', ' order by ordinal_position), '')
      into view_cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'listing_sellers';

    if view_cols <> 'listing_id:uuid, display_name:text, city:text, phone:text' then
      blocked := blocked || format('view public.listing_sellers columns: %s; canonical listing_id:uuid, display_name:text, city:text, phone:text',
                                   view_cols);
    end if;

    -- Read access is what 002 grants, so read access is what is checked.
    --
    -- The write privileges are deliberately NOT checked. A Supabase project
    -- carries `alter default privileges ... grant all on tables to anon,
    -- authenticated, service_role` in schema public, so every new relation —
    -- this view included — is created holding arwdDxtm for those roles, and
    -- 002 revokes nothing. Demanding their absence would fail on every real
    -- project while proving nothing: what actually keeps the view read-only is
    -- checked below instead.
    foreach enum_name in array array['anon', 'authenticated'] loop
      if not exists (select 1 from pg_roles where rolname = enum_name) then
        blocked := blocked || format('role %s does not exist, so the canonical grants cannot be verified', enum_name);
      elsif not has_table_privilege(enum_name, 'public.listing_sellers', 'SELECT') then
        blocked := blocked || format('view public.listing_sellers: %s has no SELECT; 002 grants it', enum_name);
      end if;
    end loop;

    -- What makes the view unwritable is its shape, not its ACL: it joins two
    -- tables and carries one computed column, so PostgreSQL will not auto-update
    -- it, and a write is refused however wide the grants are. That holds only
    -- while nothing supplies write behaviour of its own. An INSTEAD OF trigger
    -- or an extra rewrite rule would make the view writable through those same
    -- grants, so both stop the migration. Neither is removed automatically:
    -- whoever added one has to be asked why.
    for rec in
      select tg.tgname::text as name,
             (pr.pronamespace::regnamespace::text || '.' || pr.proname::text) as func
      from pg_trigger tg
      join pg_proc pr on pr.oid = tg.tgfoid
      where tg.tgrelid = 'public.listing_sellers'::regclass
        and not tg.tgisinternal
      order by 1
    loop
      blocked := blocked || format(
        'view public.listing_sellers carries trigger %L calling %s; the canonical view has none, and an INSTEAD OF trigger would make it writable. Review it by hand.',
        rec.name, rec.func);
    end loop;

    for rec in
      select rw.rulename::text as name, rw.ev_type::text as ev_type
      from pg_rewrite rw
      where rw.ev_class = 'public.listing_sellers'::regclass
        and not (rw.rulename = '_RETURN' and rw.ev_type = '1')
      order by 1
    loop
      blocked := blocked || format(
        'view public.listing_sellers carries rewrite rule %L (ev_type %s) beside the standard SELECT _RETURN rule; it would make the view writable. Review it by hand.',
        rec.name, rec.ev_type);
    end loop;
  end if;

  -- 4.11 the bucket, on the three settings 002 actually manages
  if not exists (
    select 1 from storage.buckets
    where id = 'listing-images' and public
      and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  ) then
    blocked := blocked || 'storage.buckets.listing-images does not match the canonical bucket configuration';
  end if;

  ---------------------------------------------------------------------------
  -- 5. auth.users must be byte-identical to what it was.
  ---------------------------------------------------------------------------
  select md5(coalesce(string_agg(to_jsonb(u)::text, '|' order by u.id), ''))
    into auth_digest_after
  from auth.users u;

  if auth_digest_after is distinct from auth_digest_before then
    blocked := blocked || 'auth.users content changed during the migration';
  end if;

  if array_length(blocked, 1) is not null then
    raise exception 'RATATAI reconcile: BLOCKED — the schema does not match the canonical contract.%',
      format(E'\n  - %s%s',
             array_to_string(blocked, E'\n  - '),
             case when is_legacy then E'\n  The conversion has been rolled back.'
                  else E'\n  Nothing was changed.' end)
      using errcode = 'raise_exception';
  end if;

  raise notice 'RATATAI reconcile: done (%).',
    case when is_legacy then 'legacy converted to canonical' else 'already canonical, verified, unchanged' end;
end
$reconcile$;
