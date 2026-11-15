import nodemailer from "nodemailer";

let transport;
function getTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass || !process.env.SMTP_FROM) return null;
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE === "true", auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
  }
  return transport;
}

function developmentConsoleMailEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_EMAIL_MODE === "console";
}

export function emailDeliveryConfigured() {
  return developmentConsoleMailEnabled() || Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM);
}

export async function sendAccountEmail({ to, subject, text, html }) {
  if (developmentConsoleMailEnabled()) {
    console.log("[ATLAS DEV EMAIL] Solo desarrollo; abre el enlace desde la computadora del servidor.", { to, subject, text });
    return { sent: false, configured: true, developmentConsole: true };
  }
  const mailer = getTransport();
  if (!mailer) return { sent: false, configured: false };
  await mailer.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
  return { sent: true, configured: true };
}
