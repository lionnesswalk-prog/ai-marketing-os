import React from "react";
import { AppChrome } from "../components/AppChrome";
import "./globals.css";
import "./auth.css";

export const metadata = {
  title: "AI Marketing OS",
  description: "AI-powered marketing operations platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><AppChrome>{children}</AppChrome></body>
    </html>
  );
}
