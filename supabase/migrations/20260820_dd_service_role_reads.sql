-- Give service_role the reads the dd-send-email Edge Function actually needs.
--
-- Supabase's default privileges normally hand service_role full access to new
-- public tables, but on this project it holds only REFERENCES, TRIGGER and
-- TRUNCATE on every table that predates the DD email work — the data
-- privileges were removed at some point and never restored. The two tables
-- created by 20260820_dd_email_settings.sql work only because that migration
-- stated their grants explicitly instead of relying on the defaults.
--
-- The visible symptom was the Edge Function failing with
--   "Could not read promo rules: permission denied for table qrdd_promo_rules"
-- because it builds its reports with the service-role client, which must see
-- every row regardless of RLS.
--
-- Scope: read-only, and only the tables the function opens. service_role is the
-- trusted server-side key and never reaches the browser, so this is restoring
-- an expected privilege rather than widening one. It is deliberately NOT
-- `grant select on all tables in schema public` — the next table added should
-- have to say what it wants.

-- Report data. The function reads all three: promo_reminder reads promo rules,
-- data_confirmation and weekly_export walk all of DD_TABLES.
grant select on public.qrdd_bu_accounts        to service_role;
grant select on public.qrdd_merchant_whitelist to service_role;
grant select on public.qrdd_promo_rules        to service_role;

-- Access resolution. mayUpdateEmail() re-derives the `email.update` feature
-- server-side because src/lib/access.js runs in the browser and cannot be
-- trusted by a function. It reads these four with the service-role client so a
-- caller cannot hide a row from their own access check via RLS.
--
-- These matter more than they look. The companion change in the Edge Function
-- makes every one of these reads deny on error, because a failed feature_access
-- read returns null, null is indistinguishable from "zero rows", and zero rows
-- is computeAccess's default-all branch — so before that change a permission
-- error here would have silently granted every feature in the module.
grant select on public.module_state  to service_role;
grant select on public.module_access to service_role;
grant select on public.feature_access to service_role;
grant select on public.user_access   to service_role;

-- Not granted, deliberately:
--   profiles      — read with the caller's own client, under RLS, on purpose.
--   dd_audit_log  — the function does not read it; the reports come from the
--                   data tables directly with a date window.
