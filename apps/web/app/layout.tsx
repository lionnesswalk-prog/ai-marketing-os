import React from "react";
import { AppChrome } from "../components/AppChrome";
import { getSession } from "../lib/auth";
import { listAccessibleWorkspaces } from "../lib/workspaces";
import "./globals.css";
import "./auth.css";
import "./profile.css";
import "./social-hub.css";
import "./analytics.css";
import "./clients.css";
import "./team.css";
import "./platform.css";

export const metadata = {
  title: "AI Marketing OS",
  description: "AI-powered marketing operations platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const workspaces = session ? await listAccessibleWorkspaces(session).catch(() => []) : [];

  return (
    <html lang="en">
      <body>
        <AppChrome session={session} workspaces={workspaces}>{children}</AppChrome>
      </body>
    </html>
  );
}
