"use client";

import { FormEvent, useState } from "react";

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      brandName: String(form.get("brandName") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      acceptTerms: form.get("acceptTerms") === "on",
    };

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Signup failed (${response.status}).`);
      }

      window.location.assign("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Full name<input name="name" autoComplete="name" minLength={2} maxLength={80} required placeholder="Your name" /></label>
      <label>Brand / company name<input name="brandName" minLength={2} maxLength={120} required placeholder="Your brand name" /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={200} required placeholder="you@company.com" /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required placeholder="Minimum 8 characters" /></label>
      <label style={{ display: "flex", gridTemplateColumns: "auto 1fr", alignItems: "start", gap: 10 }}>
        <input name="acceptTerms" type="checkbox" required style={{ width: 18, marginTop: 2 }} />
        <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
      </label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn auth-submit" type="submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
