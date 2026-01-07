import React, { useMemo, useState } from "react";

function getFunctionUrl(supabaseUrl, fnName) {
  const base = (supabaseUrl || "").replace(/\/$/, "");
  return `${base}/functions/v1/${fnName}`;
}

function getErrorMessage(data, status) {
  return (
    data?.error ||
    data?.message ||
    data?.details ||
    `Request failed (${status}).`
  );
}

export default function App() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    service: "BHFOS Demo Request",
    message: "",
  });

  // Honeypot field: bots will often fill this; humans never see it.
  const [website, setWebsite] = useState("");

  const [status, setStatus] = useState({ state: "idle", message: "" });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Optional version stamp (set in Vercel env if you want)
  const buildSha =
    import.meta.env.VITE_GIT_COMMIT ||
    import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ||
    "";

  const endpoint = useMemo(() => {
    if (!supabaseUrl) return null;
    return getFunctionUrl(supabaseUrl, "submit-form");
  }, [supabaseUrl]);

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.service.trim();

  async function onSubmit(e) {
    e.preventDefault();

    // Bot trap: pretend success to avoid tipping off spammers.
    if (website && website.trim().length > 0) {
      setStatus({ state: "success", message: "Received. We'll reach out soon." });
      return;
    }

    if (!endpoint || !anonKey) {
      setStatus({
        state: "error",
        message:
          "Missing env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel (Production + Preview) and redeploy.",
      });
      return;
    }

    setStatus({ state: "loading", message: "Sending…" });

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Not strictly required for your current submit-form, but safe to include.
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          service: form.service,
          message: form.message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          state: "error",
          message: getErrorMessage(data, res.status),
        });
        return;
      }

      setStatus({ state: "success", message: "Received. We'll reach out soon." });
      setForm({
        name: "",
        email: "",
        phone: "",
        service: "BHFOS Demo Request",
        message: "",
      });
      setWebsite("");
    } catch (err) {
      setStatus({
        state: "error",
        message: err?.message || "Network error.",
      });
    }
  }

  const envOk = Boolean(supabaseUrl && anonKey);

  return (
    <div className="page">
      <div style={{ maxWidth: 820, margin: "40px auto", padding: 20 }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0 }}>BHFOS</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Command Center CRM — multi-tenant operations system. Request a demo below.
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <a href="https://app.bhfos.com" target="_blank" rel="noreferrer">
              Go to App
            </a>
            <small>
              Env: {envOk ? "OK" : "Missing"}
              {buildSha ? ` · Build: ${buildSha.slice(0, 7)}` : ""}
            </small>
          </div>
        </header>

        <section style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 8 }}>What it does</h2>
          <ul style={{ lineHeight: 1.6, marginTop: 0 }}>
            <li>Centralize leads, pipeline, and follow-up</li>
            <li>Standardize execution and reporting</li>
            <li>Prove outcomes with measurable dashboards</li>
          </ul>
        </section>

        <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Request a demo</h2>

          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
            {/* Honeypot (hidden off-screen) */}
            <div style={{ position: "absolute", left: "-9999px", top: "auto" }}>
              <label>
                Website
                <input
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Phone *</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Interest *</label>
              <select
                value={form.service}
                onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                required
              >
                <option>BHFOS Demo Request</option>
                <option>Multi-tenant CRM</option>
                <option>Operations + Automation</option>
                <option>Partner / Franchise-ready system</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>

            <button type="submit" disabled={!canSubmit || status.state === "loading"}>
              {status.state === "loading" ? "Sending…" : "Submit"}
            </button>

            {status.state !== "idle" && (
              <p style={{ margin: 0, color: status.state === "error" ? "crimson" : "green" }}>
                {status.message}
              </p>
            )}

            {!envOk && (
              <small>
                Tip: set env vars for <b>Production</b> and <b>Preview</b> in Vercel, then redeploy.
              </small>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
