import formData from "form-data";
import Mailgun from "mailgun.js";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

let mailgunClient: any = null;

function getMailgunClient() {
  if (mailgunClient) {
    return mailgunClient;
  }

  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!apiKey || !domain) {
    console.warn("[EmailService] MAILGUN_API_KEY or MAILGUN_DOMAIN not configured. Email will be disabled.");
    return null;
  }

  const mailgun = new Mailgun(formData);
  mailgunClient = mailgun.client({
    username: "api",
    key: apiKey,
  });

  console.log("[EmailService] ✅ Mailgun client initialized for domain:", domain);
  return mailgunClient;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const fromAddress = process.env.NOTIFICATION_EMAIL_FROM;
  const domain = process.env.MAILGUN_DOMAIN;

  if (!fromAddress) {
    console.warn("[EmailService] NOTIFICATION_EMAIL_FROM is not configured. Email will not be sent.");
    return;
  }

  if (!domain) {
    console.warn("[EmailService] MAILGUN_DOMAIN is not configured. Email will not be sent.");
    return;
  }

  const client = getMailgunClient();
  if (!client) {
    console.warn("[EmailService] Mailgun client unavailable. Email send skipped.");
    console.log("[EmailService] Email payload:", options);
    return;
  }

  try {
    const messageData = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || undefined,
      "h:Reply-To": fromAddress,
      ...options.headers,
    };

    const response = await client.messages.create(domain, messageData);

    if (process.env.NODE_ENV !== "production") {
      console.log("[EmailService] ✅ Email sent via Mailgun:", response.id);
    }
  } catch (error) {
    console.error("[EmailService] Failed to send email via Mailgun:", error);
    throw error;
  }
}
