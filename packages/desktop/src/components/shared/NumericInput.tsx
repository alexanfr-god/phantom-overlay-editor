import React, { useState, useEffect } from "react";

interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}

export function NumericInput({ label, value, onChange, min, max, step = 1, unit, disabled }: Props) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(Math.round(value * 100) / 100));
  }, [value]);

  const commit = () => {
    let n = parseFloat(raw);
    if (isNaN(n)) { setRaw(String(value)); return; }
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    onChange(n);
    setRaw(String(n));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </label>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          type="number"
          value={raw}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          style={{
            width: "100%",
            height: 30,
            backgroundColor: disabled ? "#1e1e1e" : "#2a2a2a",
            border: "1px solid #3a3a3a",
            borderRadius: 6,
            color: disabled ? "#555" : "#e8e8e8",
            fontSize: 13,
            padding: unit ? "0 24px 0 8px" : "0 8px",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {unit && (
          <span style={{
            position: "absolute",
            right: 7,
            fontSize: 11,
            color: "#555",
            pointerEvents: "none",
          }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
