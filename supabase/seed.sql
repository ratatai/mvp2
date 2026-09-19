-- ===========================================================================
-- RATATAI marketplace — OPTIONAL demo data
-- ---------------------------------------------------------------------------
-- FOR LOCAL AND STAGING ONLY. Do not run this against production: the quality
-- gate requires that no demo listing is ever visible on the live site.
--
-- Prerequisites: at least one registered user. Register through the app, or
-- create one in Supabase Dashboard → Authentication → Users. The script
-- attaches the demo listings to the OLDEST existing user and does nothing at
-- all if there are none, or if listings already exist.
--
-- To remove the demo data afterwards:
--     delete from public.listings where slug like 'demo-%';
-- ===========================================================================

do $$
declare
  demo_user uuid;
  existing_count integer;
begin
  select id into demo_user
  from auth.users
  order by created_at
  limit 1;

  if demo_user is null then
    raise notice 'RATATAI seed: no users found, nothing inserted.';
    return;
  end if;

  select count(*) into existing_count from public.listings;

  if existing_count > 0 then
    raise notice 'RATATAI seed: listings already exist, nothing inserted.';
    return;
  end if;

  insert into public.profiles (id, display_name, phone, phone_is_public, city)
  values (demo_user, 'Demo pardavėjas', '+37060000000', true, 'Vilnius')
  on conflict (id) do update
  set display_name = coalesce(public.profiles.display_name, excluded.display_name),
      city = coalesce(public.profiles.city, excluded.city);

  -- Tires -------------------------------------------------------------------
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, slug
  )
  values (
    demo_user,
    'padangos',
    'Michelin Primacy 4 205/55 R16 vasarinės',
    'Keturios vasarinės padangos, naudotos vieną sezoną. Protektorius tolygus, pažeidimų nėra. Galima apžiūrėti Vilniuje.',
    'used',
    180.00,
    4,
    'Vilnius',
    jsonb_build_object(
      'brand', 'Michelin',
      'model', 'Primacy 4',
      'width', 205,
      'aspect_ratio', 55,
      'diameter', 16,
      'season', 'summer',
      'tread_depth', 6.5,
      'manufacturing_year', 2022,
      'load_index', 91,
      'speed_index', 'V',
      'sale_unit', 'set'
    ),
    'active',
    'demo-michelin-primacy-4-205-55-r16'
  );

  -- Rims --------------------------------------------------------------------
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, slug
  )
  values (
    demo_user,
    'ratlankiai',
    'BBS CH-R R18 8.5J 5x112 ET35 lieti ratlankiai',
    'Originalūs BBS ratlankiai, be riebalų ir be virinimo. Vienas ratlankis turi nedidelį įbrėžimą ant krašto, matosi nuotraukose.',
    'used',
    950.00,
    4,
    'Kaunas',
    jsonb_build_object(
      'brand', 'BBS',
      'model', 'CH-R',
      'diameter', 18,
      'rim_width', 8.5,
      'bolt_count', 5,
      'pcd', '5x112',
      'cb', 66.6,
      'et', 35,
      'material', 'alloy',
      'origin', 'aftermarket',
      'fitment', 'Audi A4, A6, VW Passat'
    ),
    'active',
    'demo-bbs-ch-r-r18-5x112'
  );

  -- Complete wheels ---------------------------------------------------------
  insert into public.listings (
    user_id, category, title, description, condition, price, quantity,
    city, specs, status, slug
  )
  values (
    demo_user,
    'komplektiniai_ratai',
    'Žieminis komplektas R17 5x114.3 su Nokian padangomis',
    'Plieniniai ratlankiai su žieminėmis Nokian padangomis. Komplektas paruoštas montavimui, balansuotas.',
    'used',
    420.00,
    4,
    'Klaipėda',
    jsonb_build_object(
      'rim', jsonb_build_object(
        'brand', 'Steel',
        'diameter', 17,
        'rim_width', 7,
        'bolt_count', 5,
        'pcd', '5x114.3',
        'cb', 67.1,
        'et', 45,
        'material', 'steel',
        'condition', 'used'
      ),
      'tire', jsonb_build_object(
        'brand', 'Nokian',
        'model', 'Hakkapeliitta R3',
        'width', 225,
        'aspect_ratio', 55,
        'diameter', 17,
        'season', 'winter',
        'tread_depth', 7.0,
        'studded', false,
        'condition', 'used'
      )
    ),
    'active',
    'demo-ziemines-r17-5x114-3-nokian'
  );

  raise notice 'RATATAI seed: 3 demo listings inserted for user %.', demo_user;
end $$;
