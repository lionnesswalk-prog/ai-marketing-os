"use client";

import { FormEvent, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const quickPrompts = [
  "What should this brand post this week?",
  "Give me three campaign ideas for this month.",
  "How can we improve this brand's positioning?",
  "What marketing knowledge is missing from this workspace?",
];

export function BrandCopilot({
  brandName,
  initialMessages,
}: {
  brandName: string;
  initialMessages: ChatMessage[];
}) {
  const welcome: ChatMessage = {
    role: "assistant",
    content: "Ask me anything about " + brandName + "'s marketing, content, campaigns, positioning or saved brand knowledge. I will use this workspace's Brand Profile and Knowledge Base as context.",
  };
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages.length ? initialMessages : [welcome]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function ask(value?: string) {
    const text = (value ?? question).trim();
    if (!text || busy) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setQuestion("");
    setBusy(true);
    setNotice("");
    setError("");

    try {
      const response = await fetch("/api/brand-copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: text,
          messages: nextMessages.slice(-10),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Brand Copilot is unavailable.");
      setMessages((current) => [...current, { role: "assistant", content: body.answer }]);
      setNotice(body.warning || (body.mode === "mock" ? "Safe built-in advisory mode is active." : ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Brand Copilot is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void ask();
  }

  return (
    <section className="card copilot-card">
      <div className="section-head top-align">
        <div>
          <p className="eyebrow">BRAND AI COPILOT</p>
          <h2>Talk to your brand intelligence</h2>
          <p className="muted">Ask for ideas, strategy, content suggestions, launch plans, audience thinking or what information should be added to the Knowledge Base.</p>
        </div>
        <span className="pill accent">{initialMessages.length ? "History saved" : "Workspace aware"}</span>
      </div>

      <div className="copilot-quick">
        {quickPrompts.map((prompt) => (
          <button type="button" key={prompt} disabled={busy} onClick={() => void ask(prompt)}>{prompt}</button>
        ))}
      </div>

      <div className="copilot-thread" aria-live="polite">
        {messages.map((message, index) => (
          <div className={"copilot-message " + message.role} key={index}>
            <span>{message.role === "assistant" ? "AI" : "You"}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {busy && <div className="copilot-message assistant"><span>AI</span><p>Thinking with the saved brand context…</p></div>}
      </div>

      <form className="copilot-form" onSubmit={submit}>
        <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your brand, marketing strategy, content, campaigns or saved knowledge..." />
        <button className="btn" type="submit" disabled={busy || question.trim().length < 2}>{busy ? "Thinking…" : "Ask Brand AI"}</button>
      </form>

      {notice && <div className="profile-notice">{notice}</div>}
      {error && <div className="profile-notice error">{error}</div>}
    </section>
  );
}
