import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: SendMailOptions["headers"];
}

let transporterPromise: Promise<Transporter | null> | null = null;

async function createTransporter(): Promise<Transporter | null> {
  const smtpUrl = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  try {
    if (smtpUrl) {
      return nodemailer.createTransport(smtpUrl);
    }

    if (host) {
      if (!port) {
        console.warn("[EmailService] SMTP_HOST provided without SMTP_PORT – cannot configure transporter.");
        return null;
      }

      const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;

      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  } catch (error) {
    console.error("[EmailService] Failed to configure transporter", error);
    return null;
  }

  console.warn("[EmailService] No SMTP configuration found. Set SMTP_URL or SMTP_HOST/SMTP_PORT.");
  return null;
}

async function getTransporter(): Promise<Transporter | null> {
  if (!transporterPromise) {
    transporterPromise = createTransporter();
  }
  return transporterPromise;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const fromAddress = process.env.NOTIFICATION_EMAIL_FROM;
  if (!fromAddress) {
    console.warn("[EmailService] NOTIFICATION_EMAIL_FROM is not configured. Email will not be sent.");
    return;
  }

  const transporter = await getTransporter();
  if (!transporter) {
    console.warn("[EmailService] Transporter unavailable. Email send skipped.");
    console.log("[EmailService] Email payload:", options);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      headers: options.headers,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[EmailService] Email dispatched (preview)", info);
    }
  } catch (error) {
    console.error("[EmailService] Failed to send email", error);
    throw error;
  }
}
