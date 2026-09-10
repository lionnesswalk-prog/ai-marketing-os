"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  ["/dashboard", "Dashboard"],
  ["/campaigns", "Campaigns"],
  ["/strategy", "AI Strategy"],
  ["/social", "Social Content"],
  ["/leads", "Leads"],
  ["/approvals", "Approvals"],
];

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage) return <main className="auth-shell">{children}</main>;

  return (
    <>
      <aside className="sidebar">
        <div className="brand">AI MARKETING OS</div>
        <div className="brand-sub">Internal-first · SaaS-ready</div>
        <nav>
          {nav.map(([href, label]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <div className="sidebar-foot sidebar-foot-stack">
          <div><span className="status-dot" /> Safe automation mode</div>
          <form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="shell">{children}</main>
    </>
  );
}
