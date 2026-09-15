"use client";

import { useState } from "react";

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
};

export function PasswordField({
  label,
  name,
  autoComplete,
  minLength,
  maxLength,
  placeholder,
  required = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label>
      {label}
      <span className="password-field">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          placeholder={placeholder}
        />
        <button
          className="password-toggle"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
