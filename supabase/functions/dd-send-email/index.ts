// SP-lite — dd-send-email Edge Function (DD module, Phase 6).
//
// Sends one of DD's three scheduled report mails over the company's Zimbra
// SMTP. Called two ways:
//   * a person pressing "Send now" on /dd/email, with their own JWT
//   * pg_cron via pg_net, with the service-role key (see
//     supabase/migrations/20260820_dd_email_settings.sql)
//
// ── REQUIRED SECRETS ────────────────────────────────────────────────────────
// Set with `supabase secrets set NAME=value` (or Studio > Edge Functions >
// Secrets). No host, port or credential is hardcoded anywhere in this file.
//
//   DD_SMTP_HOST       Zimbra SMTP hostname
//   DD_SMTP_PORT       SMTP port
//   DD_SMTP_USER       SMTP username           (optional: omit for an open relay)
//   DD_SMTP_PASS       SMTP password           (optional, with the above)
//   DD_SMTP_FROM       envelope/from address
//   DD_SMTP_FROM_NAME  display name            (optional, defaults to "DD MPM")
//   DD_SMTP_TLS        "true" for implicit TLS on connect; anything else means
//                      plain connect with STARTTLS if the server offers it
//   DD_APP_URL         link behind the {{app_button}} in the mail (optional)
//
// Auto-injected by the platform: SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY.
//
// ── KNOWN UNVERIFIED ────────────────────────────────────────────────────────
// It has NOT been confirmed that the Zimbra host is reachable from Supabase's
// Edge runtime; an internal-only mail server is not routable from a hosted
// function. That failure is handled explicitly rather than hidden: a connect
// that cannot be made returns a plain "could not reach the mail server" and is
// written to dd_email_log as a failed attempt. Nothing here silently succeeds.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Shared with the browser preview on purpose — one renderer, so what someone
// sees in DdEmail.vue is what leaves the building.
import {
  EMAIL_TEMPLATES,
  renderEmail,
  renderSubject,
} from "../../../src/modules/dd/lib/email-templates.js";
import { DD_TABLES, EXPORT_ORDER } from "../../../src/modules/dd/lib/schema.js";

// DD's MAIL_CONFIG.lookbackDays. The confirmation and export mails both report
// this window.
const LOOKBACK_DAYS = 6;
// Promos ending inside this many days are listed by the reminder mail.
const EXPIRY_HORIZON_DAYS = 14;
// An unroutable host would otherwise sit in connect() until the platform kills
// the invocation and the caller gets nothing useful back.
const SMTP_TIMEOUT_MS = 20000;

const TZ = "Asia/Jakarta";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/* ── Access ──────────────────────────────────────────────────────────────── */

/**
 * Server-side equivalent of computeAccess(user, ctx) narrowed to one question:
 * may this person write DD's email settings? It has to be re-derived here
 * because src/lib/access.js runs in the browser and a caller could simply not
 * run it. The branch order matches that file exactly, default-all included.
 */
async function mayUpdateEmail(
  // deno-lint-ignore no-explicit-any
  caller: any,
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
): Promise<boolean> {
  const { data: state } = await admin
    .from("module_state").select("is_enabled").eq("module_id", "dd").maybeSingle();
  if (state && state.is_enabled === false) return false;

  const { data: prof } = await caller
    .from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
  if (!prof || prof.is_active === false) return false;

  const { data: overrides } = await admin
    .from("user_access").select("module_id, feature_id, mode").eq("user_id", userId);
  const ov = (overrides || []).filter((o: { module_id: string }) => o.module_id === "dd");
  // Deny wins, and a whole-module deny outranks any grant — checked first so a
  // later grant branch cannot reinstate what was denied.
  for (const o of ov) {
    if (o.mode !== "deny") continue;
    if (!o.feature_id || o.feature_id === "email.update") return false;
  }

  if (prof.role === "Admin") return true;

  for (const o of ov) {
    if (o.mode === "deny") continue;
    if (!o.feature_id || o.feature_id === "email.update") return true;
  }

  const { data: mod } = await admin
    .from("module_access").select("module_id").eq("role", prof.role).eq("module_id", "dd");
  if (!mod || !mod.length) return false;

  const { data: feats } = await admin
    .from("feature_access").select("feature_id").eq("role", prof.role).eq("module_id", "dd");
  // Zero explicit rows is computeAccess's default-all branch: the role holds
  // the module, so it holds every feature in it.
  if (!feats || !feats.length) return true;
  return feats.some((f: { feature_id: string }) => f.feature_id === "email.update");
}

/* ── Data gathering ──────────────────────────────────────────────────────── */

/** Today at 00:00 in Jakarta, as a plain yyyy-mm-dd string. */
function todayInTz(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Whole days from today (Jakarta) to a yyyy-mm-dd date, negative when past. */
function daysUntil(ymd: string): number | null {
  if (!ymd) return null;
  const end = Date.parse(`${ymd}T00:00:00Z`);
  const today = Date.parse(`${todayInTz()}T00:00:00Z`);
  if (isNaN(end)) return null;
  return Math.round((end - today) / 86400000);
}

// deno-lint-ignore no-explicit-any
async function promoReminderData(admin: any) {
  const { data, error } = await admin
    .from("qrdd_promo_rules")
    .select("promo_name, bu_name, end_date, status");
  if (error) throw new Error(`Could not read promo rules: ${error.message}`);

  const rows = data || [];
  // deno-lint-ignore no-explicit-any
  const active = rows.filter((r: any) => String(r.status).toUpperCase() === "ACTIVE");

  const expiring = [];
  const overdue = [];
  for (const r of active) {
    const d = daysUntil(r.end_date);
    if (d === null) continue;
    if (d < 0) overdue.push({ name: r.promo_name, end: r.end_date, days: Math.abs(d) });
    else if (d <= EXPIRY_HORIZON_DAYS) {
      expiring.push({ name: r.promo_name, bu: r.bu_name, end: r.end_date, days: d });
    }
  }
  expiring.sort((a, b) => a.days - b.days);
  overdue.sort((a, b) => b.days - a.days);

  return { activeCount: active.length, expiring, overdue };
}

// Local column carrying the human-readable name, per table. schema.js has the
// keys and the downstream names but not this, because only the mails need it.
const DISPLAY_COLUMN: Record<string, string> = {
  bu_accounts: "name",
  merchants: "merchant_name",
  promos: "promo_name",
};

/**
 * Rows of one table touched since `since`, tagged INSERT or UPDATE. DD read two
 * timestamp columns off a sheet; here they are always created_at/updated_at,
 * whatever the downstream names in schema.js are.
 */
// deno-lint-ignore no-explicit-any
async function changesSince(admin: any, tableId: string, since: Date) {
  const t = DD_TABLES[tableId];
  const iso = since.toISOString();
  const { data, error } = await admin
    .from(t.local)
    .select("*")
    .or(`created_at.gte.${iso},updated_at.gte.${iso}`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not read ${t.label}: ${error.message}`);

  // deno-lint-ignore no-explicit-any
  return (data || []).map((row: any) => {
    const created = row.created_at ? Date.parse(row.created_at) : NaN;
    const updated = row.updated_at ? Date.parse(row.updated_at) : NaN;
    const newest = Math.max(isNaN(created) ? -Infinity : created, isNaN(updated) ? -Infinity : updated);
    // Created and updated land within a second of each other on a fresh insert.
    const isNew = !isNaN(created) && (isNaN(updated) || Math.abs(updated - created) < 1500);
    return { row, when: new Date(newest), kind: isNew ? "INSERT" : "UPDATE" };
  });
}

// deno-lint-ignore no-explicit-any
async function dataConfirmationData(admin: any) {
  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 86400000);

  const totals = [];
  const perTable = [];
  const detail = [];

  for (const id of EXPORT_ORDER) {
    const t = DD_TABLES[id];
    const { count } = await admin.from(t.local).select("*", { count: "exact", head: true });
    totals.push({ label: t.label, records: count ?? 0 });

    const changed = await changesSince(admin, id, since);
    // deno-lint-ignore no-explicit-any
    const inserts = changed.filter((c: any) => c.kind === "INSERT").length;
    perTable.push({
      label: t.label, inserts, updates: changed.length - inserts, total: changed.length,
    });

    const nameCol = DISPLAY_COLUMN[id];
    for (const c of changed) {
      const key = t.keyColumns.map((k: string) => c.row[k] ?? "").join("|");
      detail.push({
        kind: c.kind,
        label: t.label,
        record: c.row[nameCol] ?? key,
        key,
        when: c.when,
        by: c.row.updated_by || c.row.created_by || "",
      });
    }
  }

  // deno-lint-ignore no-explicit-any
  detail.sort((a: any, b: any) => b.when - a.when);
  return { lookbackDays: LOOKBACK_DAYS, since, until, totals, perTable, detail };
}

// deno-lint-ignore no-explicit-any
async function weeklyExportData(admin: any) {
  const until = new Date();
  const since = new Date(until.getTime() - LOOKBACK_DAYS * 86400000);

  const manifest = [];
  const seenDbs: string[] = [];

  for (const id of EXPORT_ORDER) {
    const t = DD_TABLES[id];
    const changed = await changesSince(admin, id, since);
    if (!changed.length) continue;
    if (!seenDbs.includes(t.targetDb)) seenDbs.push(t.targetDb);
    manifest.push({
      db: t.targetDb, table: t.targetTable, type: "INSERT",
      statements: changed.length, cache: false,
    });
  }

  // One cache reset per database that produced statements, at the bottom —
  // same order and same rule as DD's _buildExportBlob.
  for (const db of ["ihybrid_order", "ihybrid_discount"]) {
    if (!seenDbs.includes(db)) continue;
    manifest.push({ db, table: "app_instances", type: "UPDATE", statements: 1, cache: true });
  }

  return { lookbackDays: LOOKBACK_DAYS, since, until, manifest };
}

// deno-lint-ignore no-explicit-any
function gather(template: string, admin: any) {
  if (template === "promo_reminder") return promoReminderData(admin);
  if (template === "data_confirmation") return dataConfirmationData(admin);
  if (template === "weekly_export") return weeklyExportData(admin);
  throw new Error(`Unknown template: ${template}`);
}

/* ── SMTP ────────────────────────────────────────────────────────────────── */

const ADDRESS_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function addressList(v: string | null): string[] {
  return String(v || "").split(/[,;]/).map((a) => a.trim()).filter(Boolean);
}

class SendError extends Error {
  constructor(message: string, readonly reachable: boolean) {
    super(message);
  }
}

/**
 * Turns whatever the SMTP layer threw into one sentence the person who pressed
 * the button can act on. A DNS or connect failure is by far the likeliest one
 * here and must not read like a generic error.
 */
function describeSmtpFailure(e: unknown): SendError {
  const raw = e instanceof Error ? e.message : String(e);
  const name = e instanceof Error ? e.name : "";
  const unreachable =
    name === "NotFound" ||                       // DNS did not resolve
    name === "ConnectionRefused" ||
    name === "TimedOut" ||
    /timed out|refused|dns|getaddrinfo|unreachable|no route/i.test(raw);
  if (unreachable) {
    return new SendError(
      "Could not reach the mail server. The Zimbra host is not answering from " +
        `Supabase's Edge runtime, which is the connectivity that has not been confirmed yet (${raw}).`,
      false,
    );
  }
  if (/auth|credential|535|534|password/i.test(raw)) {
    return new SendError(`The mail server rejected the credentials: ${raw}`, true);
  }
  return new SendError(`The mail server refused the message: ${raw}`, true);
}

async function sendMail(
  opts: { to: string[]; cc: string[]; subject: string; html: string },
): Promise<void> {
  const host = Deno.env.get("DD_SMTP_HOST");
  const port = Number(Deno.env.get("DD_SMTP_PORT"));
  const from = Deno.env.get("DD_SMTP_FROM");
  if (!host || !port || !from) {
    throw new SendError(
      "SMTP is not configured. DD_SMTP_HOST, DD_SMTP_PORT and DD_SMTP_FROM must be set " +
        "as Edge Function secrets before anything can be sent.",
      false,
    );
  }
  const user = Deno.env.get("DD_SMTP_USER");
  const pass = Deno.env.get("DD_SMTP_PASS");
  const fromName = Deno.env.get("DD_SMTP_FROM_NAME") || "DD MPM";

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      // Implicit TLS (465) when asked for; otherwise plain connect, which
      // denomailer upgrades with STARTTLS if the server advertises it.
      tls: Deno.env.get("DD_SMTP_TLS") === "true",
      auth: user ? { username: user, password: pass || "" } : undefined,
    },
  });

  let timer: number | undefined;
  try {
    await Promise.race([
      client.send({
        from: `${fromName} <${from}>`,
        to: opts.to,
        cc: opts.cc.length ? opts.cc : undefined,
        subject: opts.subject,
        html: opts.html,
      }),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new SendError(
            `Could not reach the mail server: no response from ${host}:${port} within ` +
              `${SMTP_TIMEOUT_MS / 1000}s. An internal-only host is not routable from ` +
              "Supabase's Edge runtime, which is the connectivity that has not been confirmed yet.",
            false,
          )),
          SMTP_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    throw e instanceof SendError ? e : describeSmtpFailure(e);
  } finally {
    clearTimeout(timer);
    // close() throws on a connection that was never opened; the send result is
    // already decided by this point, so it must not overwrite it.
    try { await client.close(); } catch { /* nothing to close */ }
  }
}

/* ── Handler ─────────────────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey);

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ ok: false, error: "Missing auth token" }, 401);

  // pg_cron calls with the service-role key; there is no user behind it.
  const isService = token === serviceKey;
  let actor = "SCHEDULE";

  if (!isService) {
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);
    if (!(await mayUpdateEmail(caller, admin, user.id))) {
      return json({ ok: false, error: "You do not have permission to send DD emails" }, 403);
    }
    const { data: prof } = await caller
      .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    actor = prof?.full_name || user.email || "UNKNOWN";
  }

  let body: { template?: string; preview?: boolean } = {};
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const template = String(body.template || "");
  if (!EMAIL_TEMPLATES[template]) {
    return json({ ok: false, error: `Unknown template: ${template || "(none)"}` }, 400);
  }

  const { data: settings, error: settingsErr } = await admin
    .from("dd_email_settings").select("*").eq("template", template).maybeSingle();
  if (settingsErr) return json({ ok: false, error: settingsErr.message }, 500);
  if (!settings) return json({ ok: false, error: `No settings row for ${template}` }, 404);

  const to = addressList(settings.to_addresses);
  const cc = addressList(settings.cc_addresses);
  const recipients = [...to, ...cc].join(", ");

  // Everything below writes an attempt row, so define the recorder once.
  async function record(status: "sent" | "failed", error: string | null) {
    await admin.from("dd_email_log").insert({ template, recipients, status, error, actor });
    await admin.from("dd_email_settings").update({
      last_sent_at: new Date().toISOString(),
      last_status: status,
      last_error: error,
    }).eq("template", template);
  }

  let html: string;
  let subject: string;
  try {
    const now = new Date();
    const data = await gather(template, admin);
    html = renderEmail(template, settings.html, data, {
      appUrl: Deno.env.get("DD_APP_URL") || "",
      now,
    });
    subject = renderSubject(settings.subject, now);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // A preview that cannot be built is not an attempt to send, so it is not
    // logged as one.
    if (!body.preview) await record("failed", message);
    return json({ ok: false, stage: "render", error: message }, 500);
  }

  // Preview stops here: nothing is sent, nothing is logged, no recipient is
  // touched. The screen renders the returned markup inside a sandboxed iframe.
  if (body.preview) return json({ ok: true, preview: true, template, subject, html });

  if (!settings.is_enabled) {
    const message = "This template is paused. Enable it before sending.";
    await record("failed", message);
    return json({ ok: false, stage: "config", error: message }, 409);
  }
  if (!to.length) {
    const message = "No To address is set for this template.";
    await record("failed", message);
    return json({ ok: false, stage: "config", error: message }, 400);
  }
  const bad = [...to, ...cc].filter((a) => !ADDRESS_RE.test(a));
  if (bad.length) {
    const message = `Invalid address: ${bad[0]}`;
    await record("failed", message);
    return json({ ok: false, stage: "config", error: message }, 400);
  }

  try {
    await sendMail({ to, cc, subject, html });
  } catch (e) {
    const err = e instanceof SendError ? e : describeSmtpFailure(e);
    await record("failed", err.message);
    // 502, not 500: the request was fine, the mail server was not. Never a bare
    // stack trace — the caller gets the sentence, the platform logs keep the rest.
    return json({
      ok: false,
      stage: "smtp",
      reachable: err.reachable,
      template,
      recipients,
      error: err.message,
    }, 502);
  }

  await record("sent", null);
  return json({ ok: true, template, subject, recipients, sentAt: new Date().toISOString() });
});
