import { base64EncodeBytes } from './pdfUtils.ts';

type HtmlToPdfResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string; status?: number; details?: unknown };

const PDFSHIFT_ENDPOINT = 'https://api.pdfshift.io/v3/convert/pdf';

const asString = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export async function renderHtmlToPdfBytes(params: {
  html: string;
  filename?: string;
  letter?: boolean;
}) : Promise<HtmlToPdfResult> {
  const apiKey = asString(Deno.env.get('PDFSHIFT_API_KEY'));
  if (!apiKey) {
    return { ok: false, error: 'Missing PDFSHIFT_API_KEY secret in function environment.' };
  }

  const html = String(params.html || '').trim();
  if (!html) return { ok: false, error: 'Missing HTML content for PDF rendering.' };

  const payload = {
    source: html,
    landscape: false,
    format: params.letter === false ? 'A4' : 'Letter',
    margin: '0.45in',
    use_print: true,
    // Keep external assets enabled so we can use public logo/badges.
    disable_javascript: true,
  };

  let res: Response;
  try {
    res = await fetch(PDFSHIFT_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'PDF renderer request failed.' };
  }

  if (!res.ok) {
    let details: unknown = null;
    let text = '';
    try {
      text = await res.text();
      try {
        details = JSON.parse(text);
      } catch {
        details = text.slice(0, 500);
      }
    } catch {
      // ignore
    }

    const msg =
      (details && typeof details === 'object' && (details as Record<string, unknown>).error)
        ? String((details as Record<string, unknown>).error)
        : (details && typeof details === 'object' && (details as Record<string, unknown>).message)
          ? String((details as Record<string, unknown>).message)
          : typeof details === 'string'
            ? details
            : '';

    const summary = msg ? msg.slice(0, 180) : '';
    return {
      ok: false,
      error: `PDFShift error ${res.status}${summary ? `: ${summary}` : ''}`,
      status: res.status,
      details,
    };
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.length) return { ok: false, error: 'PDF renderer returned empty output.' };
  return { ok: true, bytes };
}

export function pdfAttachmentFromBytes(params: {
  filename: string;
  bytes: Uint8Array;
}) {
  return {
    filename: params.filename,
    content: base64EncodeBytes(params.bytes),
    content_type: 'application/pdf',
  };
}
