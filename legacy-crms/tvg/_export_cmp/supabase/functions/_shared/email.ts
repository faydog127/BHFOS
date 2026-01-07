
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LEADS_TO = Deno.env.get("LEADS_TO") || "leads@vent-guys.com"; // Fallback to a safe default

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: any[];
}

export async function sendEmail(params: SendEmailParams) {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    throw new Error("Email configuration missing");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: params.from || "The Vent Guys <noreply@vent-guys.com>",
      to: params.to,
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo || LEADS_TO,
      cc: params.cc,
      bcc: params.bcc,
      attachments: params.attachments
    }),
  });

  const data = await res.json();
  
  if (!res.ok) {
    console.error("Resend API Error:", data);
    throw new Error(data.message || "Failed to send email");
  }

  return data;
}

export { LEADS_TO };
