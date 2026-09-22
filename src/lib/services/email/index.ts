import { Resend } from "resend";

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Sensitive content (code/link) that may be logged to the console in non-production only. */
  devLog: string;
}

const isProduction = () => process.env.NODE_ENV === "production";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Plain, monochrome layout: no images, no colors beyond black/gray/white, safe in dark mode clients.
function layout(heading: string, bodyHtml: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#ffffff;color:#111111;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:480px;margin:0 auto;">
<h1 style="font-size:20px;margin:0 0 16px;color:#111111;">${escapeHtml(heading)}</h1>
${bodyHtml}
<p style="font-size:12px;color:#555555;margin:24px 0 0;">If you did not request this, you can ignore this email.</p>
</div></body></html>`;
}

/**
 * Sends via Resend. Returns true on success.
 * - No RESEND_API_KEY in development: logs the sensitive content to the server console, returns true.
 * - No RESEND_API_KEY (or EMAIL_FROM) in production: fails closed (returns false) with a server log
 *   that never contains the code or link.
 */
async function deliver(message: EmailMessage): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (isProduction()) {
      console.error(
        "[email] RESEND_API_KEY or EMAIL_FROM is not configured; email was not sent (failing closed)."
      );
      return false;
    }

    console.info(`[email:dev] To: ${message.to} | ${message.subject} | ${message.devLog}`);
    return true;
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text
    });

    if (error) {
      console.error(`[email] Resend rejected the message: ${error.name}`);
      return false;
    }

    return true;
  } catch {
    console.error("[email] Failed to reach Resend.");
    return false;
  }
}

export async function sendVerificationCodeEmail(to: string, code: string, ttlMinutes: number) {
  const subject = "Your Ascension verification code";
  const text = `Your Ascension verification code is ${code}.\n\nIt expires in ${String(ttlMinutes)} minutes. Never share this code with anyone.\n\nIf you did not request this, you can ignore this email.`;
  const html = layout(
    "Verify your email",
    `<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Enter this code to verify your email address:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 16px;padding:12px 16px;background:#f2f2f2;color:#111111;text-align:center;font-family:'Courier New',monospace;">${escapeHtml(code)}</p>
<p style="font-size:14px;line-height:1.5;margin:0;color:#333333;">It expires in ${String(ttlMinutes)} minutes. Never share this code with anyone.</p>`
  );

  return deliver({ to, subject, html, text, devLog: `verification code: ${code}` });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, ttlMinutes: number) {
  const subject = "Reset your Ascension password";
  const text = `Use this link to reset your Ascension password:\n\n${resetUrl}\n\nIt expires in ${String(ttlMinutes)} minutes and can be used once.\n\nIf you did not request this, you can ignore this email.`;
  const html = layout(
    "Reset your password",
    `<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Use the link below to choose a new password. It expires in ${String(ttlMinutes)} minutes and can be used once.</p>
<p style="margin:0 0 16px;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#111111;color:#ffffff;text-decoration:none;font-size:15px;">Reset password</a></p>
<p style="font-size:12px;line-height:1.5;margin:0;color:#555555;word-break:break-all;">${escapeHtml(resetUrl)}</p>`
  );

  return deliver({ to, subject, html, text, devLog: `reset link: ${resetUrl}` });
}

export async function sendWelcomeEmail(to: string, name?: string | null) {
  const subject = "Welcome to Ascension";
  const greeting = name ? `Hi ${name},` : "Hi,";
  const text = `${greeting}\n\nWelcome to Ascension. Your account is ready.\n\nSign in any time with your email, username, or Google.`;
  const html = layout(
    "Welcome to Ascension",
    `<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">${escapeHtml(greeting)}</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Your account is ready. Sign in any time with your email, username, or Google.</p>`
  );

  return deliver({ to, subject, html, text, devLog: `welcome email sent to ${to}` });
}
