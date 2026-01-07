// TVG branded email utilities + Resend wrapper

// --- TVG BRAND + CONTACT ---
export const BUSINESS_PHONE_DISPLAY = "(321) 360-9704";
export const BUSINESS_PHONE_TEL = "+13213609704"; // E.164 for tel links
export const BUSINESS_EMAIL = "info@vent-guys.com";
export const BUSINESS_WEBSITE = "https://vent-guys.com";
export const PRIVACY_URL = "https://vent-guys.com/privacy";
export const TERMS_URL = "https://vent-guys.com/terms"; // create if missing

// Brand palette
const COLOR_NAVY_DARK = "#091e39";
const COLOR_NAVY = "#173861";
const COLOR_RED = "#b52025";
const COLOR_TEXT = "#231f20";
const COLOR_BG = "#d1d3d4";

// Storage asset helpers (public bucket)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ASSET_BUCKET = "vent-guys-images";
function storagePublicUrl(file: string) {
  if (!SUPABASE_URL) return "";
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSET_BUCKET}/${encodeURIComponent(file)}`;
}

// Image assets (env overrides allowed)
export const LOGO_URL = Deno.env.get("EMAIL_LOGO_URL") || storagePublicUrl("Version-02.png");
export const BADGE_NADCA_URL = Deno.env.get("EMAIL_BADGE_NADCA_URL") || storagePublicUrl("NADCA-Logo-2016-RGB_hires.png");
export const BADGE_CLEAN_AIR_URL = Deno.env.get("EMAIL_BADGE_CLEAN_AIR_URL") || storagePublicUrl("CleanAirCert_Colored_no_background.png");
export const BADGE_SDVOSB_URL = Deno.env.get("EMAIL_BADGE_SDVOSB_URL") || storagePublicUrl("Service-Disabled Veteran-Owned-Certified.png");

// Standardize client-facing service names
const SERVICE_DISPLAY_NAMES: Record<string, string> = {
  DRYER_VENT_CLEANING: "Dryer Vent Inspection & Cleaning",
  AIR_DUCT_CLEANING: "Air Duct Cleaning (Residential)",
  COMBO: "Whole Home Air Quality Package",
  COMMERCIAL: "Commercial Vent Inspection",
  default: "Service Request",
};

export function getPrettyServiceName(raw?: string) {
  if (!raw) return SERVICE_DISPLAY_NAMES.default;
  return SERVICE_DISPLAY_NAMES[raw] || raw;
}

export function safeText(input?: unknown) {
  return (input ?? "").toString().trim();
}

// Minimal HTML escaping for user-provided fields
export function escapeHtml(input?: unknown) {
  return safeText(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export type Badge = { label: string; url: string; link?: string };

export function renderEmailLayout(opts: {
  preheader?: string;
  title?: string;
  bodyHtml: string;
  badges?: Badge[];
  legalHtml?: string;
}) {
  const preheader = escapeHtml(opts.preheader ?? "");
  const title = escapeHtml(opts.title ?? "");
  const badges = (opts.badges ?? []).filter((b) => !!b.url).slice(0, 3);

  const badgeRow = badges.length
    ? `
      <tr>
        <td style="padding: 10px 24px 0 24px;">
          ${badges
            .map((b) => {
              const img = `<img src="${b.url}" alt="${escapeHtml(b.label)}" height="26" style="display:inline-block; border:0; outline:none; text-decoration:none; margin-right:10px;" />`;
              return b.link ? `<a href="${b.link}" style="text-decoration:none;">${img}</a>` : img;
            })
            .join("")}
        </td>
      </tr>
    `
    : "";

  const legalBlock = opts.legalHtml
    ? `
      <tr>
        <td style="padding: 0 24px 18px 24px;">
          <div style="background:#f7f7f7; border-left:4px solid ${COLOR_RED}; padding:12px; border-radius:6px; color:#555; font-size:12px; line-height:1.45;">
            ${opts.legalHtml}
          </div>
        </td>
      </tr>
    `
    : "";

  const headerLeft = LOGO_URL
    ? `<a href="${BUSINESS_WEBSITE}" style="text-decoration:none;">
         <img src="${LOGO_URL}" alt="The Vent Guys" height="44" style="display:block; border:0; outline:none; text-decoration:none;" />
       </a>`
    : `<div style="color:#fff; font-weight:bold; font-size:16px;">The Vent Guys</div>`;

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background:${COLOR_BG};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">
    ${preheader}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:22px 12px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0"
               style="border-collapse:collapse; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(90deg, ${COLOR_NAVY_DARK}, ${COLOR_NAVY}); padding:18px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    ${headerLeft}
                  </td>
                  <td align="right" style="vertical-align:middle; color:#fff; font-family: Arial, sans-serif; font-size:12px;">
                    <a href="tel:${BUSINESS_PHONE_TEL}" style="color:#fff; text-decoration:none;">${BUSINESS_PHONE_DISPLAY}</a><br/>
                    <a href="${BUSINESS_WEBSITE}" style="color:#fff; text-decoration:none;">vent-guys.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="height:4px; background:${COLOR_RED};"></td></tr>

          ${badgeRow}

          <tr>
            <td style="padding:18px 24px 10px 24px; color:${COLOR_TEXT}; font-family: Arial, sans-serif; font-size:15px; line-height:1.6;">
              ${opts.bodyHtml}
            </td>
          </tr>

          ${legalBlock}

          <tr>
            <td style="padding:14px 24px 22px 24px; background:#fafafa; color:#666; font-family: Arial, sans-serif; font-size:12px; line-height:1.5;">
              <div style="margin-bottom:10px;">
                <strong style="color:${COLOR_NAVY_DARK};">The Vent Guys</strong><br/>
                <a href="mailto:${BUSINESS_EMAIL}" style="color:${COLOR_NAVY}; text-decoration:none;">${BUSINESS_EMAIL}</a> •
                <a href="tel:${BUSINESS_PHONE_TEL}" style="color:${COLOR_NAVY}; text-decoration:none;">${BUSINESS_PHONE_DISPLAY}</a>
              </div>

              <div style="margin-bottom:10px;">
                <a href="${PRIVACY_URL}" style="color:#666; text-decoration:underline;">Privacy</a> •
                <a href="${TERMS_URL}" style="color:#666; text-decoration:underline;">Terms</a>
              </div>

              <div style="color:#888; font-size:11px;">Honest. Protective. Professional.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// --- Resend wrapper ---
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
      from: params.from || `The Vent Guys <${BUSINESS_EMAIL}>`,
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
