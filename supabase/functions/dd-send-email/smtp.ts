// A small SMTP submission client, written directly against Deno's TCP APIs.
//
// WHY THIS EXISTS INSTEAD OF denomailer
//
// denomailer opens its connection from the SMTPClient constructor, in a
// background task. When the server hangs up mid-handshake, the throw surfaces
// as a Deno "event loop error" rather than a rejection of the promise send()
// returns — so it cannot be caught by the caller, not with try/catch and not
// with an unhandledrejection listener (tried, deployed, still fatal). The
// isolate is torn down instead. The visible result is a 503 that carries none
// of the function's CORS headers, which the browser then reports as a CORS
// failure, which sends everyone looking in the wrong place. Nothing reaches
// dd_email_log because the code that writes it never runs.
//
// Every await below is ours, so every failure is an ordinary rejection with a
// message naming the step it died on.
//
// SCOPE: submission only, and only what the DD report mails need — one From,
// many To/Cc, a UTF-8 HTML body, AUTH LOGIN or PLAIN over STARTTLS. No
// attachments, no pooling, no DSN, no 8BITMIME negotiation. It is deliberately
// not a general-purpose mailer; if it grows one, reach for a library again.

export interface SmtpConfig {
  hostname: string;
  port: number;
  username?: string;
  password?: string;
  /** Implicit TLS from the first byte (port 465). Otherwise STARTTLS. */
  implicitTls?: boolean;
  /** Logs the conversation. Redacts the AUTH exchange — see redact(). */
  debug?: boolean;
  timeoutMs?: number;
}

export interface Mail {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}

/** Which step of the conversation failed, so the log names it. */
export class SmtpError extends Error {
  constructor(readonly step: string, message: string, readonly reply?: string) {
    super(message);
    this.name = "SmtpError";
  }
}

const CRLF = "\r\n";
const enc = new TextEncoder();
const dec = new TextDecoder();

/** AUTH LOGIN puts base64 of the username and password on the wire as bare
 *  lines. Without this the debug log would be a credential store. */
function redact(line: string): string {
  if (/^(AUTH\s+(LOGIN|PLAIN))/i.test(line)) return line.replace(/\s+\S+$/, " <redacted>");
  if (/^[A-Za-z0-9+/=]{8,}$/.test(line.trim())) return "<redacted base64>";
  return line;
}

class Session {
  #conn: Deno.Conn;
  #buf = "";
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  #log: string[] = [];

  constructor(conn: Deno.Conn, private cfg: SmtpConfig) {
    this.#conn = conn;
    this.#reader = conn.readable.getReader();
  }

  get transcript(): string[] {
    return this.#log;
  }

  #note(dir: ">" | "<", text: string) {
    const line = `${dir} ${redact(text.trim())}`;
    this.#log.push(line);
    if (this.cfg.debug) console.log(`[smtp] ${line}`);
  }

  /** Replaces the conn after a STARTTLS upgrade. */
  swap(conn: Deno.Conn) {
    try { this.#reader.releaseLock(); } catch { /* already released */ }
    this.#conn = conn;
    this.#reader = conn.readable.getReader();
    this.#buf = "";
  }

  get conn(): Deno.Conn {
    return this.#conn;
  }

  async write(step: string, line: string): Promise<void> {
    this.#note(">", line);
    const w = this.#conn.writable.getWriter();
    try {
      await w.write(enc.encode(line + CRLF));
    } catch (e) {
      throw new SmtpError(step, `could not write to the connection: ${msg(e)}`);
    } finally {
      w.releaseLock();
    }
  }

  /**
   * Reads one complete reply. SMTP continuation lines are "250-" and the final
   * one is "250 " — reading a single chunk is not enough, since a multi-line
   * EHLO answer arrives in as many packets as the server feels like.
   */
  async read(step: string): Promise<{ code: number; text: string }> {
    const deadline = Date.now() + (this.cfg.timeoutMs ?? 20000);
    for (;;) {
      const complete = this.#completeReply();
      if (complete) return complete;

      if (Date.now() > deadline) {
        throw new SmtpError(step, `timed out after ${this.cfg.timeoutMs ?? 20000}ms waiting for a reply`);
      }

      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await this.#reader.read();
      } catch (e) {
        throw new SmtpError(step, `the connection failed while reading: ${msg(e)}`);
      }
      if (chunk.done) {
        // This is denomailer's "invalid cmd", named properly.
        throw new SmtpError(
          step,
          "the server closed the connection without replying" +
            (this.#buf ? ` (partial: ${this.#buf.trim()})` : ""),
        );
      }
      this.#buf += dec.decode(chunk.value, { stream: true });
    }
  }

  #completeReply(): { code: number; text: string } | null {
    const lines = this.#buf.split(CRLF);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // A final line is "NNN " (space), a continuation is "NNN-".
      if (/^\d{3} /.test(l)) {
        const used = lines.slice(0, i + 1);
        this.#buf = lines.slice(i + 1).join(CRLF);
        const text = used.join("\n");
        this.#note("<", text);
        return { code: Number(l.slice(0, 3)), text };
      }
    }
    return null;
  }

  async expect(step: string, ...codes: number[]): Promise<{ code: number; text: string }> {
    const r = await this.read(step);
    if (!codes.includes(r.code)) {
      throw new SmtpError(step, `expected ${codes.join("/")} but got ${r.code}: ${r.text.trim()}`, r.text);
    }
    return r;
  }

  async cmd(step: string, line: string, ...codes: number[]) {
    await this.write(step, line);
    return await this.expect(step, ...codes);
  }

  close() {
    try { this.#reader.releaseLock(); } catch { /* ignore */ }
    try { this.#conn.close(); } catch { /* already gone */ }
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** Parses the capability lines of an EHLO reply into an upper-cased set. */
function capabilities(ehlo: string): Set<string> {
  const caps = new Set<string>();
  for (const raw of ehlo.split("\n").slice(1)) {
    const l = raw.replace(/^\d{3}[- ]/, "").trim().toUpperCase();
    if (l) caps.add(l.split(/\s+/)[0]);
  }
  return caps;
}

function b64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

/** RFC 2047 for a Subject that is not pure ASCII. */
function encodeHeader(v: string): string {
  // deno-lint-ignore no-control-regex
  return /^[\x20-\x7E]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`;
}

function wrap76(s: string): string {
  return (s.match(/.{1,76}/g) ?? []).join(CRLF);
}

function buildMessage(m: Mail): string {
  const from = m.fromName ? `${encodeHeader(m.fromName)} <${m.from}>` : m.from;
  const headers = [
    `From: ${from}`,
    `To: ${m.to.join(", ")}`,
    ...(m.cc?.length ? [`Cc: ${m.cc.join(", ")}`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
  ];
  // base64 rather than quoted-printable: it cannot produce a line starting with
  // a period, so the dot-stuffing rule in RFC 5321 §4.5.2 cannot corrupt the
  // body, and the templates are long enough that hand-rolling that would be a
  // real risk.
  const body = wrap76(b64(m.html));
  return headers.join(CRLF) + CRLF + CRLF + body;
}

/**
 * Connects, authenticates and sends. Resolves with the transcript so a caller
 * can log where a successful send went, and rejects with an SmtpError naming
 * the step that failed.
 */
export async function sendMail(cfg: SmtpConfig, mail: Mail): Promise<string[]> {
  const timeoutMs = cfg.timeoutMs ?? 20000;

  let conn: Deno.Conn;
  try {
    conn = cfg.implicitTls
      ? await Deno.connectTls({ hostname: cfg.hostname, port: cfg.port })
      : await Deno.connect({ hostname: cfg.hostname, port: cfg.port });
  } catch (e) {
    throw new SmtpError("connect", `could not open a connection to ${cfg.hostname}:${cfg.port} — ${msg(e)}`);
  }

  const s = new Session(conn, { ...cfg, timeoutMs });
  try {
    await s.expect("greeting", 220);

    const ehloName = "sp-lite.local";
    let caps = capabilities((await s.cmd("ehlo", `EHLO ${ehloName}`, 250)).text);

    if (!cfg.implicitTls) {
      if (!caps.has("STARTTLS")) {
        throw new SmtpError(
          "starttls",
          "the server does not offer STARTTLS on this port, and submitting credentials " +
            "over a plaintext link is not acceptable",
        );
      }
      await s.cmd("starttls", "STARTTLS", 220);

      // The step everything hinged on: whether this runtime can upgrade a live
      // socket. If Deno.startTls is unavailable or refused here, it fails as a
      // named error rather than tearing down the isolate.
      let tls: Deno.Conn;
      try {
        tls = await Deno.startTls(s.conn, { hostname: cfg.hostname });
      } catch (e) {
        throw new SmtpError(
          "starttls-upgrade",
          `the TLS upgrade failed after the server accepted STARTTLS — ${msg(e)}. ` +
            "If this runtime does not implement Deno.startTls, SMTP submission on a " +
            "STARTTLS-only port is not reachable from here and the mail has to be sent " +
            "from somewhere that can hold the connection.",
        );
      }
      s.swap(tls);

      // RFC 3207 §4.2: everything learned before the upgrade is discarded, and
      // AUTH in particular is only advertised afterwards on this server.
      caps = capabilities((await s.cmd("ehlo-tls", `EHLO ${ehloName}`, 250)).text);
    }

    if (cfg.username) {
      const authLine = [...caps].find((c) => c === "AUTH");
      if (!authLine) {
        throw new SmtpError("auth", "the server advertises no AUTH mechanism after STARTTLS");
      }
      // AUTH PLAIN in one round trip where offered, LOGIN otherwise. Both are
      // advertised here; PLAIN is fewer round trips and no less secure once the
      // session is encrypted.
      const pass = cfg.password ?? "";
      try {
        await s.cmd("auth", `AUTH PLAIN ${b64(`\0${cfg.username}\0${pass}`)}`, 235);
      } catch (e) {
        if (!(e instanceof SmtpError) || e.step !== "auth") throw e;
        await s.cmd("auth-login", "AUTH LOGIN", 334);
        await s.cmd("auth-user", b64(cfg.username), 334);
        await s.cmd("auth-pass", b64(pass), 235);
      }
    }

    await s.cmd("mail-from", `MAIL FROM:<${mail.from}>`, 250);
    for (const rcpt of [...mail.to, ...(mail.cc ?? [])]) {
      await s.cmd("rcpt-to", `RCPT TO:<${rcpt}>`, 250, 251);
    }

    await s.cmd("data", "DATA", 354);
    await s.write("body", buildMessage(mail));
    await s.cmd("end-of-data", ".", 250);

    try { await s.cmd("quit", "QUIT", 221); } catch { /* the mail is already accepted */ }
    return s.transcript;
  } finally {
    s.close();
  }
}
