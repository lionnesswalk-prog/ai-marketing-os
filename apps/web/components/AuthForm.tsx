"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type AuthFormProps = { mode: "login" | "signup" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const signup = mode === "signup";
  return (
    <form className="auth-form" onSubmit={submit}>
      {signup && <label>Full name<input name="name" autoComplete="name" minLength={2} required placeholder="Your name" /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@company.com" /></label>
      <label>Password<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required placeholder="Minimum 8 characters" /></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="btn auth-submit" disabled={loading} type="submit">{loading ? "Working…" : signup ? "Create account" : "Sign in"}</button>
    </form>
  );
}
