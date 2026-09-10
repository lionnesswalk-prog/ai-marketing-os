import React from "react";
import { AppChrome } from "../components/AppChrome";
import { getSession } from "../lib/auth";
import "./globals.css";
import "./auth.css";
import "./profile.css";

export const metadata = {
  title: "AI Marketing OS",
  description: "AI-powered marketing operations platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body><AppChrome session={session}>{children}</AppChrome></body>
    </html>
  );
}
