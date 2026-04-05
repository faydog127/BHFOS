export function Segmented({ label, options, value, onChange, required }) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {required ? <span className="field-required">Required</span> : null}
      </div>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              type="button"
              key={option.value}
              className={`segmented-button ${active ? "is-active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TileGroup({ label, options, value, onChange }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="tile-group" role="group" aria-label={label}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              type="button"
              key={option.value}
              className={`tile ${active ? "is-active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              <div className="tile-title">{option.label}</div>
              {option.helper ? <div className="tile-helper">{option.helper}</div> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ToggleButtons({ label, value, onChange }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="toggle-group" role="group" aria-label={label}>
        {[true, false].map((option) => {
          const active = value === option;
          return (
            <button
              type="button"
              key={String(option)}
              className={`toggle ${active ? "is-active" : ""}`}
              onClick={() => onChange(option)}
            >
              {option ? "Yes" : "No"}
            </button>
          );
        })}
        <button
          type="button"
          className={`toggle ${value === null ? "is-active" : ""}`}
          onClick={() => onChange(null)}
        >
          Unknown
        </button>
      </div>
    </div>
  );
}
