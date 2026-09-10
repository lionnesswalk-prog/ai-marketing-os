import React from "react";
import "./globals.css";

export const metadata = {
  title: "AI Marketing OS",
  description: "AI-powered marketing operations platform",
};

const nav = [
  ["/dashboard", "Dashboard"],
  ["/campaigns", "Campaigns"],
  ["/strategy", "AI Strategy"],
  ["/social", "Social Content"],
  ["/leads", "Leads"],
  ["/approvals", "Approvals"],
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <aside className="sidebar">
          <div className="brand">AI MARKETING OS</div>
          <div className="brand-sub">Internal-first · SaaS-ready</div>
          <nav>
            {nav.map(([href, label]) => (
              <a href={href} key={href}>{label}</a>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="status-dot" /> Safe automation mode
          </div>
        </aside>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
