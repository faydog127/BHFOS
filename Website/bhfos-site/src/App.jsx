import React, { useMemo, useState, useEffect, useRef } from "react";

function getFunctionUrl(supabaseUrl, fnName) {
  const base = (supabaseUrl || "").replace(/\/$/, "");
  return `${base}/functions/v1/${fnName}`;
}

function getErrorMessage(data, status) {
  return data?.error || data?.message || data?.details || `Request failed (${status}).`;
}

export default function App() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    service: "BHFOS Demo Request",
    message: "",
  });

  const [errors, setErrors] = useState({});
  // Honeypot
  const [website, setWebsite] = useState("");

  const [status, setStatus] = useState({ state: "idle", message: "" });
  const statusRef = useRef(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Show build sha only in DEV (keep public UI clean)
  const buildSha = import.meta.env.DEV ? (import.meta.env.VITE_GIT_COMMIT || "") : "";

  const endpoint = useMemo(() => {
    if (!supabaseUrl) return null;
    return getFunctionUrl(supabaseUrl, "submit-form");
  }, [supabaseUrl]);

  const envOk = Boolean(supabaseUrl && anonKey);

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.service.trim();

  const fieldIds = {
    name: "name",
    email: "email",
    phone: "phone",
    company: "company",
    service: "service",
    message: "message",
  };

  function digitsOnly(value) {
    return (value || "").replace(/\D/g, "");
  }

  function formatPhone(value) {
    const digits = digitsOnly(value).slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const validators = {
    name: (v) => (v.trim() ? "" : "Name is required"),
    email: (v) => {
      if (!v.trim()) return "Email is required";
      return /\S+@\S+\.\S+/.test(v) ? "" : "Enter a valid email";
    },
    phone: (v) => {
      const digits = digitsOnly(v);
      if (!digits) return "Phone is required";
      return digits.length >= 10 ? "" : "Enter a valid phone";
    },
    service: (v) => (v.trim() ? "" : "Interest is required"),
  };

  function validateField(name, value) {
    if (!validators[name]) return "";
    return validators[name](value || "");
  }

  function runValidation(fields) {
    const nextErrors = { ...errors };
    fields.forEach((f) => {
      const err = validateField(f, form[f]);
      if (err) nextErrors[f] = err;
      else delete nextErrors[f];
    });
    setErrors(nextErrors);
    return nextErrors;
  }

  function handleBlur(name) {
    const err = validateField(name, form[name]);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[name] = err;
      else delete next[name];
      return next;
    });
  }

  useEffect(() => {
    if (status.state !== "idle" && statusRef.current) {
      statusRef.current.focus({ preventScroll: true });
    }
  }, [status]);

  async function onSubmit(e) {
    e.preventDefault();

    // Bot trap: fake success
    if (website && website.trim().length > 0) {
      setStatus({ state: "success", message: "Received. We’ll reach out soon." });
      return;
    }

    if (!endpoint || !anonKey) {
      setStatus({
        state: "error",
        message:
          "Env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (local .env.local or Vercel).",
      });
      return;
    }

    const submitErrors = runValidation(["name", "email", "phone", "service"]);
    if (Object.keys(submitErrors).length) {
      setStatus({ state: "error", message: "Please fix the highlighted fields." });
      return;
    }

    setStatus({ state: "loading", message: "Sending…" });

    try {
      const formattedPhone = formatPhone(form.phone);
      const digitsPhone = digitsOnly(form.phone);

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: formattedPhone,
          phone_digits: digitsPhone,
          service: form.service,
          // we keep service/message fields compatible with your existing submit-form
          message: `Company: ${form.company || "-"}\n\n${form.message || ""}`,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({ state: "error", message: getErrorMessage(data, res.status) });
        return;
      }

      setStatus({ state: "success", message: "Received. We’ll reach out soon." });
      setForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        service: "BHFOS Demo Request",
        message: "",
      });
      setWebsite("");
    } catch (err) {
      setStatus({ state: "error", message: err?.message || "Network error." });
    }
  }

  return (
    <div className="container">
      <div className="nav">
        <div className="logo">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#4da6ff",
              display: "inline-block",
            }}
          />
          <span>BHFOS</span>
          <span className="badge">Business Backend in a Box</span>
        </div>

        <div className="actions">
          <a className="btn" href="#demo">Request demo</a>
          <a className="btn primary" href="https://app.bhfos.com" target="_blank" rel="noreferrer">
            Go to app
          </a>
        </div>
      </div>

      <div className="hero">
        <div>
          <h1 className="h1">Run operations like a system, not a scramble.</h1>
          <p className="subhead">
            BHFOS is the fast, multi-tenant back office built to capture leads, enforce follow-up,
            and prove outcomes with clean reporting.
          </p>

          <div className="panel">
            <div className="grid3">
              <div className="card">
                <h3>Pipeline that moves</h3>
                <p>Capture → qualify → schedule → close, without leads falling through the cracks.</p>
              </div>
              <div className="card">
                <h3>Execution discipline</h3>
                <p>Standardize workflows so teams perform consistently across locations.</p>
              </div>
              <div className="card">
                <h3>Proof, not opinions</h3>
                <p>Dashboards that show what’s working and what’s leaking revenue.</p>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 14 }}>
              <a className="btn primary" href="#demo">Request a demo</a>
              <a className="btn" href="#how">How it works</a>
              <span className="badge">
                Env: {envOk ? "OK" : "Missing"}
                {buildSha ? ` · Build: ${buildSha.slice(0, 7)}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="panel">
          <p className="kicker">Built for operators who care about speed and accountability.</p>
          <h2 style={{ marginTop: 0 }}>What you get in the demo</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "rgba(255,255,255,0.75)", lineHeight: 1.7 }}>
            <li>Workspace + tenant structure</li>
            <li>Lead intake to pipeline flow</li>
            <li>Reporting + performance visibility</li>
            <li>System health checks (deployment + data readiness)</li>
          </ul>
          <div style={{ marginTop: 12 }}>
            <small>Short call. Live walkthrough. Clear next steps.</small>
          </div>
        </div>
      </div>

      <div id="how" className="section">
        <h2>How it works</h2>
        <p className="kicker">Three steps. No fluff.</p>
        <div className="grid3">
          <div className="card">
            <h3>1) Capture</h3>
            <p>Centralize inbound leads with consistent intake and clean contact records.</p>
          </div>
          <div className="card">
            <h3>2) Convert</h3>
            <p>Move deals through a pipeline that enforces follow-up and handoffs.</p>
          </div>
          <div className="card">
            <h3>3) Measure</h3>
            <p>Track response time, close rate, revenue per channel, and leakage.</p>
          </div>
        </div>
      </div>

      <div id="demo" className="section">
        <h2>Request a demo</h2>
        <p className="kicker">Leave your info and we’ll reach out.</p>

        <div className="panel">
          <form className="form" onSubmit={onSubmit}>
            {/* honeypot */}
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

            <div className="grid3">
              <div className="field">
                <label htmlFor={fieldIds.name}>Name *</label>
                <input
                  id={fieldIds.name}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  onBlur={() => handleBlur("name")}
                  required
                  autoComplete="name"
                />
                {errors.name && <small style={{ color: "#fca5a5" }}>{errors.name}</small>}
              </div>
              <div className="field">
                <label htmlFor={fieldIds.email}>Email *</label>
                <input
                  id={fieldIds.email}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  onBlur={() => handleBlur("email")}
                  required
                  autoComplete="email"
                />
                {errors.email && <small style={{ color: "#fca5a5" }}>{errors.email}</small>}
              </div>
              <div className="field">
                <label htmlFor={fieldIds.phone}>Phone *</label>
                <input
                  id={fieldIds.phone}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
                  onBlur={() => handleBlur("phone")}
                  required
                />
                {errors.phone && <small style={{ color: "#fca5a5" }}>{errors.phone}</small>}
              </div>
            </div>

            <div className="grid3">
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label htmlFor={fieldIds.company}>Company</label>
                <input
                  id={fieldIds.company}
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  autoComplete="organization"
                />
              </div>
              <div className="field">
                <label htmlFor={fieldIds.service}>Interest *</label>
                <select
                  id={fieldIds.service}
                  value={form.service}
                  onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                  onBlur={() => handleBlur("service")}
                  required
                >
                  <option>BHFOS Demo Request</option>
                  <option>Multi-tenant CRM</option>
                  <option>Operations + Automation</option>
                  <option>Partner / Franchise-ready system</option>
                </select>
                {errors.service && <small style={{ color: "#fca5a5" }}>{errors.service}</small>}
              </div>
            </div>

            <div className="field">
              <label htmlFor={fieldIds.message}>Message</label>
              <textarea
                id={fieldIds.message}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>

            <div className="actions">
              <button className="btn primary" type="submit" disabled={!canSubmit || status.state === "loading"}>
                {status.state === "loading" ? <span className="spinner" aria-hidden="true"></span> : "Submit"}
              </button>
              <a className="btn" href="https://app.bhfos.com" target="_blank" rel="noreferrer">
                Go to app
              </a>
            </div>

            {status.state !== "idle" && (
              <div
                className="badge"
                style={{
                  borderColor:
                    status.state === "error" ? "rgba(220,38,38,0.6)" : "rgba(34,197,94,0.5)",
                }}
                role="status"
                aria-live="polite"
                tabIndex={-1}
                ref={statusRef}
              >
                {status.message}
              </div>
            )}

            {!envOk && (
              <div className="badge" style={{ borderColor: "rgba(234,179,8,0.7)", color: "#facc15" }}>
                Env missing: add .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or set them in Vercel.
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="footer">
        <div>© {new Date().getFullYear()} BHFOS</div>
        <div style={{ display: "flex", gap: 12 }}>
          <a href="#demo">Request demo</a>
          <a href="https://app.bhfos.com" target="_blank" rel="noreferrer">App</a>
        </div>
      </div>
    </div>
  );
}
