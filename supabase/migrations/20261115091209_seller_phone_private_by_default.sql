-- New sellers opt in to publishing their phone. Existing choices stay intact.
alter table public.profiles
  alter column phone_is_public set default false;
