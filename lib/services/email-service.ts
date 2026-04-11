import { Resend } from "resend";

/** Production app URL for email links (Vercel sets VERCEL_URL). */
export function getAppBaseUrl(): string {
  const explicit =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

function defaultFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Nexus Scheduler <onboarding@resend.dev>"
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends a transactional email when RESEND_API_KEY is set.
 * Never throws — failures are logged only so HTTP flows keep working.
 */
export async function sendCollaborationEmail(opts: {
  to: string;
  subject: string;
  text: string;
  path?: string;
}): Promise<void> {
  const to = opts.to.trim().toLowerCase();
  if (!to || !to.includes("@")) return;

  const resend = getResend();
  if (!resend) return;

  const base = getAppBaseUrl();
  const url = opts.path ? `${base}${opts.path.startsWith("/") ? opts.path : `/${opts.path}`}` : null;
  const textBody = url ? `${opts.text}\n\n${url}` : opts.text;
  const htmlBody = url
    ? `<p>${escapeHtml(opts.text)}</p><p><a href="${escapeHtml(url)}">Nexus Scheduler에서 열기</a></p>`
    : `<p>${escapeHtml(opts.text)}</p>`;

  try {
    const { error } = await resend.emails.send({
      from: defaultFrom(),
      to,
      subject: opts.subject,
      text: textBody,
      html: htmlBody,
    });
    if (error) console.error("[email] Resend:", error);
  } catch (e) {
    console.error("[email]", e);
  }
}
