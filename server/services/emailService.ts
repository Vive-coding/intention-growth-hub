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
  const fromAddress = process.env.NOTIFICATION_EMAIL_FROM?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();

  console.log("[EmailService] Configuration check:", {
    hasFromAddress: !!fromAddress,
    fromAddressLength: fromAddress?.length || 0,
    hasDomain: !!domain,
    domain: domain,
  });

  if (!fromAddress) {
    const error = new Error("NOTIFICATION_EMAIL_FROM is not configured");
    console.error("[EmailService] ❌", error.message);
    throw error;
  }

  if (!domain) {
    const error = new Error("MAILGUN_DOMAIN is not configured");
    console.error("[EmailService] ❌", error.message);
    throw error;
  }

  // Validate from address format
  // Mailgun accepts: "email@domain.com" or "Name <email@domain.com>"
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const fromMatch = fromAddress.match(/<?([^\s<>]+@[^\s<>]+\.[^\s<>]+)>?/);
  
  if (!fromMatch) {
    const error = new Error(`Invalid from address format: "${fromAddress}". Must be "email@domain.com" or "Name <email@domain.com>"`);
    console.error("[EmailService] ❌", error.message);
    throw error;
  }

  const fromEmail = fromMatch[1];
  console.log("[EmailService] Parsed from address:", {
    original: fromAddress,
    extracted: fromEmail,
  });

  // Check if domain matches
  const fromDomain = fromEmail.split('@')[1];
  if (fromDomain !== domain) {
    console.warn(`[EmailService] ⚠️ From email domain (${fromDomain}) doesn't match MAILGUN_DOMAIN (${domain}). Mailgun might reject this.`);
  }

  const client = getMailgunClient();
  if (!client) {
    const error = new Error("Mailgun client unavailable");
    console.error("[EmailService] ❌", error.message);
    throw error;
  }

  try {
    const messageData = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || undefined,
      "h:Reply-To": fromEmail, // Use just the email for Reply-To
      ...options.headers,
    };

    console.log("[EmailService] Sending email:", {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      domain: domain,
    });

    const response = await client.messages.create(domain, messageData);

    console.log("[EmailService] ✅ Email sent via Mailgun:", response.id);
  } catch (error: any) {
    console.error("[EmailService] ❌ Failed to send email via Mailgun:", {
      error: error?.message,
      status: error?.status,
      details: error?.details,
      type: error?.type,
      fromAddress: fromAddress,
      domain: domain,
    });
    throw error;
  }
}
