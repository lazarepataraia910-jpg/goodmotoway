-- GoodMotoway: allow the "moto" (სპორტული) theme and make it the stored default
-- Run this once in the Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Background: profiles.theme is constrained to the three original themes, so
-- saving the new one from the profile picker fails, and ensureProfile() in
-- auth.js cannot create a profile for a brand-new sign-in either.

alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('light', 'dark', 'classic', 'moto'));

-- new accounts start on the new design
alter table public.profiles alter column theme set default 'moto';

-- Accounts whose theme was last touched before the redesign never actually
-- chose between the old look and the new one, so move them across. Drop this
-- statement if you would rather leave existing accounts on their old theme.
update public.profiles
   set theme = 'moto', updated_at = now()
 where updated_at < timestamptz '2026-09-14 00:00:00+00';
