export function emailDeliveryConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!emailDeliveryConfigured()) throw new Error("EMAIL_PROVIDER_NOT_CONFIGURED");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [input.to],
      subject: input.subject,
      html: input.html,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`EMAIL_DELIVERY_FAILED:${response.status}:${body.slice(0, 200)}`);
  }
}

export function emailProviderLabel() {
  return emailDeliveryConfigured() ? "Transactional email configured" : "Set RESEND_API_KEY and EMAIL_FROM";
}
