export function Field({ label, actions, children }) {
  return (
    <div className="field">
      <div className="field-label">
        <div className="field-label-text">{label}</div>
        {actions ? <div className="field-actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <input
      className="input"
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      className="textarea"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
    />
  );
}
