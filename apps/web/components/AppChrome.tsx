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
] as const;

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (isAuthPage) return <main className="auth-shell">{children}</main>;

  return (
    <>
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark">AI</div>
          <div className="brand-copy">
            <div className="brand">MARKETING OS</div>
            <div className="brand-sub">Intelligence command center</div>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([href, label], index) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <a className={active ? "active" : undefined} href={href} key={href} aria-current={active ? "page" : undefined}>
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-foot sidebar-foot-stack">
          <div className="safe-mode"><span className="status-dot" /> Human-approved automation</div>
          <form action="/api/auth/logout" method="post"><button className="logout-button" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="shell">{children}</main>
    </>
  );
}
