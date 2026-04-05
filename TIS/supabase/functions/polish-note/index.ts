import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function extractOutputText(payload: Record<string, unknown>) {
  const direct = typeof payload.output_text === "string" ? payload.output_text : "";
  if (direct) return direct.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const text = output
    .flatMap((item: Record<string, unknown>) =>
      Array.isArray(item.content) ? item.content : []
    )
    .filter((part: Record<string, unknown>) => part.type === "output_text")
    .map((part: Record<string, unknown>) => String(part.text || ""))
    .join(" ")
    .trim();
  return text;
}

function extractGeminiText(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const text = candidates
    .flatMap((candidate: Record<string, unknown>) => {
      const content = candidate.content;
      if (!content || typeof content !== "object") return [];
      return Array.isArray((content as Record<string, unknown>).parts)
        ? ((content as Record<string, unknown>).parts as Array<Record<string, unknown>>)
        : [];
    })
    .map((part: Record<string, unknown>) => String(part.text || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  return text;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders
  });
}

function capitalizeSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function lightlyPolishText(input: string) {
  let text = String(input || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/^looking to get\b/i, "The property is seeking"],
    [/\bwhole property cleaned\b/gi, "whole-property cleaning"],
    [/\bcustomer has stated that\b/gi, "the customer stated that"],
    [/\bthe customer has stated that\b/gi, "the customer stated that"],
    [/\bon-going\b/gi, "ongoing"],
    [/\bbi-annual\b/gi, "biannual"],
    [/\bat this time they are only looking for\b/gi, "at this time, they are only considering"],
    [/\bat this time they are only looking to\b/gi, "at this time, they are only planning to"],
    [/\bthey are only looking for\b/gi, "they are only considering"],
    [/\bthey are only looking to\b/gi, "they are only planning to"]
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  text = text
    .replace(/\s+(The customer stated that)\b/g, ". $1")
    .replace(/\b[Tt]he the\b/g, "The")
    .replace(/\.\s+\./g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();

  let sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(capitalizeSentence)
    .filter(Boolean);

  if (sentences.length === 0) {
    sentences = [capitalizeSentence(text)];
  }

  const polished = sentences.slice(0, 2).join(" ").trim();
  return /[.!?]$/.test(polished) ? polished : `${polished}.`;
}

async function callOpenAI({
  apiKey,
  model,
  systemPrompt,
  userPrompt
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ],
      temperature: 0.2
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as Record<string, unknown>;
    const errorObject = (errorPayload.error ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      provider: "openai",
      status: response.status,
      message: String(errorObject.message || "OpenAI request failed"),
      details: payload
    };
  }

  const polished = extractOutputText(payload as Record<string, unknown>);
  if (!polished) {
    return {
      ok: false,
      provider: "openai",
      status: 502,
      message: "No output text returned from OpenAI",
      details: payload
    };
  }

  return {
    ok: true,
    polished,
    provider: "openai",
    model
  };
}

async function callGemini({
  apiKey,
  model,
  systemPrompt,
  userPrompt
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as Record<string, unknown>;
    const errorObject = (errorPayload.error ?? {}) as Record<string, unknown>;
    return {
      ok: false,
      provider: "gemini",
      status: response.status,
      message: String(errorObject.message || "Gemini request failed"),
      details: payload
    };
  }

  const polished = extractGeminiText(payload as Record<string, unknown>);
  if (!polished) {
    return {
      ok: false,
      provider: "gemini",
      status: 502,
      message: "No output text returned from Gemini",
      details: payload
    };
  }

  return {
    ok: true,
    polished,
    provider: "gemini",
    model
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = req.headers.get("authorization");
  const apiKeyHeader = req.headers.get("apikey");
  if (!auth && !apiKeyHeader) {
    return jsonResponse({ error: "Missing authorization header" }, 401);
  }

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
  const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  if (!openAiApiKey && !geminiApiKey) {
    return jsonResponse(
      { error: "Missing AI provider secret. Set OPENAI_API_KEY or GEMINI_API_KEY." },
      500
    );
  }

  let body: { text?: string; context?: string; field?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const text = String(body.text || "").trim();
  const context = String(body.context || "").trim();
  const field = String(body.field || "").trim();

  if (!text) {
    return jsonResponse({ error: "Text is required" }, 400);
  }

  const systemPrompt =
    "You are a field-intel note editor for dryer-vent safety scouting. " +
    "Rewrite notes to be professional, concise, and clear. " +
    "Preserve meaning and severity. Do not add new facts or assumptions. " +
    "Keep it 1–2 sentences. Return only the polished note.";

  const userPrompt = context
    ? `Context: ${context}${field ? ` (${field})` : ""}\n\nNote: ${text}`
    : text;

  const attempts: Array<Record<string, unknown>> = [];

  if (openAiApiKey) {
    const openAiResult = await callOpenAI({
      apiKey: openAiApiKey,
      model: openAiModel,
      systemPrompt,
      userPrompt
    });
    if (openAiResult.ok) {
      return jsonResponse({
        polished: openAiResult.polished,
        model: openAiResult.model,
        provider: openAiResult.provider
      });
    }
    attempts.push(openAiResult);
  }

  if (geminiApiKey) {
    const geminiResult = await callGemini({
      apiKey: geminiApiKey,
      model: geminiModel,
      systemPrompt,
      userPrompt
    });
    if (geminiResult.ok) {
      return jsonResponse({
        polished: geminiResult.polished,
        model: geminiResult.model,
        provider: geminiResult.provider
      });
    }
    attempts.push(geminiResult);
  }

  console.warn("polish-note falling back to rule-based output", {
    attempts: attempts.map((attempt) => ({
      provider: attempt.provider,
      status: attempt.status,
      message: attempt.message
    }))
  });
  return jsonResponse({
    polished: lightlyPolishText(text),
    model: "rule-based-fallback",
    provider: "local-fallback",
    degraded: true
  });
});
