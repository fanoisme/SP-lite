-- DD module — scheduled report emails (Phase 6).
--
-- Ports the three mails DD MPM sends (gas/Mailer.gs): promo_reminder,
-- data_confirmation and weekly_export. DD sent them with MailApp.sendEmail, ie.
-- through the Apps Script owner's Google Workspace account; SP-lite has no Apps
-- Script tier, so the transport moves to the company's own SMTP submission host
-- and that is a new dependency, not a ported one. In DD the recipients,
-- subject, markup AND schedule all lived in one `email` sheet under
-- Databases > app_config; here that sheet becomes dd_email_settings, one row
-- per template, and the sending itself moves to the dd-send-email Edge
-- Function.
--
-- KNOWN UNVERIFIED: no mail has yet been sent from Supabase's Edge runtime
-- through the company's SMTP host. The original worry was that the host was
-- internal-only and therefore unroutable; that turned out not to be the case
-- (mail.allobank.com is public and answers on 587), but whether it will accept
-- a session from an arbitrary internet address is still unproven. Everything
-- below therefore assumes sends may fail, and dd_email_log exists so a failure
-- is a recorded attempt rather than a silence. Remove the banner in DdEmail.vue
-- once a real send has landed.

-- ── dd_email_settings ───────────────────────────────────────────────────────
-- One row per template. `template` is the primary key rather than a surrogate
-- id because the Edge Function and the pg_cron job name both address a row by
-- its template name, and a renameable id would break both.

create table if not exists public.dd_email_settings (
  template      text primary key,
  label         text not null,
  notes         text,
  subject       text not null,
  -- Comma-separated, matching DD's sheet. Kept as text rather than text[] so
  -- the field round-trips through the UI exactly as the person typed it;
  -- address validation happens in the app and again in the Edge Function.
  to_addresses  text not null default '',
  cc_addresses  text not null default '',
  -- The wrapper. Must contain {{body}} — that is where the generated report is
  -- spliced in. Enforced here as well as in the UI, because a wrapper without
  -- it would send a shell with no content and look like a successful send.
  html          text not null default '' check (html = '' or html like '%{{body}}%'),
  -- Standard five-field cron, read by pg_cron, so NULL means "manual only".
  -- pg_cron fires on the database's timezone (UTC on Supabase), not WIB — the
  -- seeds below are therefore offset by -7h from DD's Asia/Jakarta times.
  schedule_cron text,
  is_enabled    boolean not null default true,
  last_sent_at  timestamptz,
  last_status   text check (last_status in ('sent', 'failed')),
  last_error    text,
  created_at    timestamptz not null default now(),
  created_by    text,
  updated_at    timestamptz not null default now(),
  updated_by    text
);

-- ── dd_email_log ────────────────────────────────────────────────────────────
-- Append-only send history. Every attempt lands here, including the ones that
-- never reached the mail server: an unreachable SMTP host is the expected
-- failure until connectivity is confirmed, and it must be visible.

create table if not exists public.dd_email_log (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  template   text not null,
  recipients text,
  status     text not null check (status in ('sent', 'failed')),
  error      text,
  actor      text not null default 'SYSTEM'
);

create index if not exists idx_dd_email_log_ts       on public.dd_email_log (ts desc);
create index if not exists idx_dd_email_log_template on public.dd_email_log (template, id desc);

-- ── Row level security ──────────────────────────────────────────────────────

-- Settings: readable by everyone signed in, writable by everyone signed in.
-- The write gate is the `email.update` feature applied in the app
-- (src/modules/dd/views/DdEmail.vue via useDdAccess), exactly as the qrdd_*
-- tables are gated today. Moving that check into RLS would mean re-deriving
-- computeAccess in SQL, which src/lib/access.js deliberately owns.
alter table public.dd_email_settings enable row level security;

grant select, insert, update, delete on public.dd_email_settings to authenticated;
revoke truncate on public.dd_email_settings from anon, authenticated;

-- The Edge Function stamps last_sent_at/last_status/last_error after every
-- attempt. Stated rather than left to Supabase's default privileges, so the
-- writer keeps working if those are ever tightened.
grant select, update on public.dd_email_settings to service_role;

drop policy if exists "dd_email_settings_read"  on public.dd_email_settings;
create policy "dd_email_settings_read" on public.dd_email_settings
  for select to authenticated using (true);

drop policy if exists "dd_email_settings_write" on public.dd_email_settings;
create policy "dd_email_settings_write" on public.dd_email_settings
  for update to authenticated using (true) with check (true);

-- No insert or delete policy: the three template rows are seeded below and the
-- app only ever edits them. A fourth mail is a code change, not a data entry.

-- Log: modelled on dd_audit_log. authenticated gets SELECT and nothing else;
-- the only writer is the dd-send-email Edge Function running as service_role,
-- which bypasses RLS. TRUNCATE is revoked explicitly rather than left to the
-- absence of a grant, because Supabase's default privileges on `public` hand
-- new tables TRUNCATE and it bypasses both RLS and row triggers.
alter table public.dd_email_log enable row level security;

grant select on public.dd_email_log to authenticated;
revoke insert, update, delete, truncate on public.dd_email_log from anon, authenticated;
grant select, insert on public.dd_email_log to service_role;

drop policy if exists "dd_email_log_read" on public.dd_email_log;
create policy "dd_email_log_read" on public.dd_email_log
  for select to authenticated using (true);

-- ── Auditing ────────────────────────────────────────────────────────────────
--
-- dd_audit_row() is deliberately NOT attached to dd_email_settings.
--
-- It logs one row per changed column with the full old and new value and has a
-- hardcoded skip list of exactly updated_at/updated_by (see
-- 20260813_dd_audit_log.sql). Two things about this table break that shape:
--
--   1. `html` is a multi-kilobyte wrapper. Every wording tweak would write two
--      copies of it into old_value/new_value. DD hit the same problem and its
--      own changelog wrote '(previous template)'/'(updated template)' instead
--      (src/views/AdminEmail.vue) — a per-column rule dd_audit_row() has no
--      way to express.
--   2. last_sent_at/last_status/last_error are written by the Edge Function on
--      every single send. Three audit rows per mail would bury the edits the
--      audit log exists to show.
--
-- Forcing it would make the Audit Log worse, so it is left off. The send
-- history that matters operationally is dd_email_log.

-- ── Seed ────────────────────────────────────────────────────────────────────
--
-- Templates, subjects and schedules are DD's, verbatim: the list and the
-- default subjects come from EMAIL_TEMPLATES in gas/Code.gs, the wrapper markup
-- from EMAIL_TEMPLATE_HTML in gas/EmailTemplates.gs (generated there from
-- gas/templates/*.html).
--
-- DD's schedules are Asia/Jakarta; pg_cron runs on UTC, so each is shifted back
-- seven hours:  Tue 10:00 WIB -> 03:00 UTC, Thu 11:00 WIB -> 04:00 UTC,
--               Fri 09:00 WIB -> 02:00 UTC.
--
-- Recipients are left empty on purpose. DD shipped them empty too and the
-- Edge Function refuses to send a mail with no To — better than inheriting a
-- guessed address list.
--
-- Guarded with `not exists` per row so re-running never overwrites wording that
-- has since been edited in the app.

insert into public.dd_email_settings (template, label, notes, subject, schedule_cron, html)
select v.template, v.label, v.notes, v.subject, v.schedule_cron, v.html
from (values
  ('promo_reminder',
   'Promo update reminder',
   'Reminder to insert or edit the QR Direct Discount promos',
   'DD MPM · Promo update reminder · {{date}}',
   '0 3 * * 2',
   $html$<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFF1F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF1F4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Inter,Helvetica,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr><td height="5" bgcolor="#FF6B00" style="height:5px;background:#FF6B00;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #E6E6E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">
<div style="font-size:18px;font-weight:700;color:#1E1E1E;letter-spacing:-0.01em;">{{brand}}</div>
<div style="font-size:12px;color:#808080;margin-top:2px;">{{subtitle}}</div>
</td>
<td valign="middle" align="right" style="white-space:nowrap;">
<span style="display:inline-block;background:#FFF3D6;color:#FF6B00;font-size:10.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 11px;border-radius:6px;">Reminder</span>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="font-size:11.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#FF6B00;white-space:nowrap;padding-right:10px;">Action required</td>
<td valign="middle" width="100%" style="width:100%;"><div style="height:1px;background:#E6E6E6;font-size:0;line-height:0;">&nbsp;</div></td>
<td valign="middle" style="padding-left:10px;white-space:nowrap;font-size:11.5px;color:#999999;">{{date}}</td>
</tr></table>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;color:#333333;font-weight:700;">{{title}}</h1>
<p style="margin:0;font-size:14px;line-height:1.65;color:#808080;">{{intro}}</p>
</td></tr>

<tr><td style="padding:14px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #FFD79A;border-radius:12px;">
<tr><td style="padding:14px 18px;font-size:13.5px;line-height:1.7;color:#333333;">
Please record the Direct Discount promos for the coming period today, and settle any promo listed below by extending its end date or setting the status to inactive. The confirmation email reports whatever stands in the sheet at the time it runs.
</td></tr>
</table>
</td></tr>

<tr><td style="padding:16px 32px 8px;">{{body}}</td></tr>
{{app_button}}
<tr><td style="padding:6px 32px 0;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">New entries and corrections are both made in the app.</div>
</td></tr>

<tr><td style="padding:22px 32px 30px;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">
Regards,<br>
<b>Stefano Adrian Sambora</b><br>
IT Project Manager<br>
IT Strategy &amp; Governance<br>
PT Allo Bank Indonesia Tbk
</div></td></tr>

</table></td></tr></table></body></html>$html$),
  ('data_confirmation',
   'Data confirmation',
   'Summary and detail of everything changed in the window',
   'DD MPM · Data confirmation · {{date}}',
   '0 4 * * 4',
   $html$<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFF1F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF1F4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Inter,Helvetica,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr><td height="5" bgcolor="#FFAF03" style="height:5px;background:#FFAF03;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #E6E6E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">
<div style="font-size:18px;font-weight:700;color:#1E1E1E;letter-spacing:-0.01em;">{{brand}}</div>
<div style="font-size:12px;color:#808080;margin-top:2px;">{{subtitle}}</div>
</td>
<td valign="middle" align="right" style="white-space:nowrap;">
<span style="display:inline-block;background:#E5EDFF;color:#2563EB;font-size:10.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 11px;border-radius:6px;">Confirmation</span>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="font-size:11.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#2563EB;white-space:nowrap;padding-right:10px;">For your review</td>
<td valign="middle" width="100%" style="width:100%;"><div style="height:1px;background:#E6E6E6;font-size:0;line-height:0;">&nbsp;</div></td>
<td valign="middle" style="padding-left:10px;white-space:nowrap;font-size:11.5px;color:#999999;">{{date}}</td>
</tr></table>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;color:#333333;font-weight:700;">{{title}}</h1>
<p style="margin:0;font-size:14px;line-height:1.65;color:#808080;">{{intro}}</p>
</td></tr>

<tr><td style="padding:14px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #C7D9FF;border-radius:12px;">
<tr><td style="padding:14px 18px;font-size:13.5px;line-height:1.7;color:#333333;">
Below is the complete set of changes recorded in the business unit, merchant and promo tables during this window. Please check it against what you expect. Any row that is wrong should be corrected in the app, not by replying to this message.
</td></tr>
</table>
</td></tr>

<tr><td style="padding:16px 32px 8px;">{{body}}</td></tr>
{{app_button}}
<tr><td style="padding:6px 32px 0;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">If nothing is raised before the next run, the data is treated as confirmed and applied as it stands.</div>
</td></tr>

<tr><td style="padding:22px 32px 30px;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">
Regards,<br>
<b>Stefano Adrian Sambora</b><br>
IT Project Manager<br>
IT Strategy &amp; Governance<br>
PT Allo Bank Indonesia Tbk
</div></td></tr>

</table></td></tr></table></body></html>$html$),
  ('weekly_export',
   'Weekly export',
   'Summary plus the export manifest for the last 6 days',
   'DD MPM · Weekly export · {{date}}',
   '0 2 * * 5',
   $html$<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFF1F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFF1F4;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;font-family:Inter,Helvetica,Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<tr><td height="5" bgcolor="#059669" style="height:5px;background:#059669;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:22px 32px 18px;border-bottom:1px solid #E6E6E6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle">
<div style="font-size:18px;font-weight:700;color:#1E1E1E;letter-spacing:-0.01em;">{{brand}}</div>
<div style="font-size:12px;color:#808080;margin-top:2px;">{{subtitle}}</div>
</td>
<td valign="middle" align="right" style="white-space:nowrap;">
<span style="display:inline-block;background:#D7F9E9;color:#059669;font-size:10.5px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:5px 11px;border-radius:6px;">Export</span>
</td>
</tr></table>
</td></tr>

<tr><td style="padding:18px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="middle" style="font-size:11.5px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#059669;white-space:nowrap;padding-right:10px;">Ready to apply</td>
<td valign="middle" width="100%" style="width:100%;"><div style="height:1px;background:#E6E6E6;font-size:0;line-height:0;">&nbsp;</div></td>
<td valign="middle" style="padding-left:10px;white-space:nowrap;font-size:11.5px;color:#999999;">{{date}}</td>
</tr></table>
</td></tr>

<tr><td style="padding:24px 32px 4px;">
<h1 style="margin:0 0 8px;font-size:20px;line-height:1.35;color:#333333;font-weight:700;">{{title}}</h1>
<p style="margin:0;font-size:14px;line-height:1.65;color:#808080;">{{intro}}</p>
</td></tr>

<tr><td style="padding:14px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #7FD9B4;border-radius:12px;">
<tr>
<td width="64" valign="top" style="width:64px;padding:15px 0 15px 16px;">
<div style="background:#059669;color:#FFFFFF;font-family:Consolas,Menlo,monospace;font-size:11px;font-weight:700;letter-spacing:0.06em;text-align:center;padding:9px 0;border-radius:8px;">XLSX</div>
</td>
<td valign="top" style="padding:15px 18px;font-size:13.5px;line-height:1.7;color:#333333;">
The workbook attached to this message holds the rows for this period, one sheet per table, together with the SQL statements that apply them in order. The statements are ready to run as they are.
</td>
</tr>
</table>
</td></tr>

<tr><td style="padding:16px 32px 8px;">{{body}}</td></tr>
{{app_button}}
<tr><td style="padding:6px 32px 0;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">Should a row differ from what you expect, please check the record in the app before the statements are run.</div>
</td></tr>

<tr><td style="padding:22px 32px 30px;">
<div style="font-size:13.5px;line-height:1.7;color:#333333;">
Regards,<br>
<b>Stefano Adrian Sambora</b><br>
IT Project Manager<br>
IT Strategy &amp; Governance<br>
PT Allo Bank Indonesia Tbk
</div></td></tr>

</table></td></tr></table></body></html>$html$)
) as v(template, label, notes, subject, schedule_cron, html)
where not exists (
  select 1 from public.dd_email_settings s where s.template = v.template
);

-- ── Scheduling ──────────────────────────────────────────────────────────────
--
-- pg_cron calls the Edge Function over HTTP through pg_net. Both extensions are
-- optional on a Supabase project, so every reference to them lives inside a
-- plpgsql body (resolved at call time, not at CREATE time) behind an explicit
-- pg_extension check. If either is missing this migration still applies and the
-- feature degrades to manual "Send now" only — nothing else changes.

-- Function URL and service-role key are read, never hardcoded. Vault is the
-- first place looked because that is where Supabase expects project secrets;
-- a `app.settings.*` GUC works as a fallback for self-hosted projects.
--
-- Required secrets (create in Supabase Studio > Project Settings > Vault):
--   dd_email_function_url        https://<project-ref>.supabase.co/functions/v1/dd-send-email
--   dd_email_service_role_key    the project's service_role key
create or replace function public.dd_email_secret(p_name text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v text;
begin
  begin
    select decrypted_secret into v
    from vault.decrypted_secrets
    where name = p_name
    limit 1;
  exception when others then
    v := null;   -- vault is not installed on this project
  end;
  return coalesce(nullif(v, ''), nullif(current_setting('app.settings.' || p_name, true), ''));
end;
$$;

revoke all on function public.dd_email_secret(text) from public, anon, authenticated;

-- Rebuilds every cron job from the settings rows. Called once at the bottom of
-- this migration and again by the app after a save, so the installed schedule
-- can never drift from what the screen shows — the drift banner DD needed
-- (AdminEmail.vue) exists only because Apps Script could not do this.
create or replace function public.dd_email_sync_schedules()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_row record;
  v_job text;
  v_n   int := 0;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return 'pg_cron is not installed on this project — nothing is scheduled. Send now still works.';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    return 'pg_net is not installed on this project — nothing is scheduled. Send now still works.';
  end if;

  v_url := public.dd_email_secret('dd_email_function_url');
  v_key := public.dd_email_secret('dd_email_service_role_key');
  if v_url is null or v_key is null then
    return 'dd_email_function_url / dd_email_service_role_key are missing from Vault — nothing is scheduled. Send now still works.';
  end if;

  for v_row in select template, schedule_cron, is_enabled from public.dd_email_settings loop
    v_job := 'dd_email_' || v_row.template;
    -- Unschedule first, unconditionally: a template that has just been paused
    -- or re-timed would otherwise keep firing on its old cron.
    begin
      perform cron.unschedule(v_job);
    exception when others then
      null;   -- no job by that name yet
    end;

    if v_row.is_enabled and coalesce(btrim(v_row.schedule_cron), '') <> '' then
      perform cron.schedule(v_job, v_row.schedule_cron, format(
        $cmd$select net.http_post(
                 url     := %L,
                 headers := jsonb_build_object(
                              'Content-Type', 'application/json',
                              'Authorization', 'Bearer ' || %L),
                 body    := jsonb_build_object('template', %L)
               );$cmd$,
        v_url, v_key, v_row.template));
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n || ' schedule(s) installed.';
end;
$$;

-- The app calls this after saving a template. It is security definer and reads
-- the two secrets, but returns only a count — and anyone who can reach it can
-- already write schedule_cron itself, so the blast radius is unchanged. The
-- app gates the button on the `email.update` feature.
revoke all on function public.dd_email_sync_schedules() from public, anon;
grant execute on function public.dd_email_sync_schedules() to authenticated, service_role;

do $$
declare
  v text;
begin
  v := public.dd_email_sync_schedules();
  raise notice 'dd_email_sync_schedules: %', v;
exception when others then
  -- Scheduling is a convenience, not a prerequisite. A project without pg_cron
  -- privileges must still end this migration with the tables in place.
  raise notice 'dd_email_sync_schedules failed, scheduling is off: %', sqlerrm;
end $$;
