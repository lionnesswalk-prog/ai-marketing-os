"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { AppSession } from "../lib/auth";
import type { WorkspaceOption } from "../lib/workspaces";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const nav = [
  ["/dashboard", "Dashboard"],
  ["/brand", "Brand Profile"],
  ["/campaigns", "Campaigns"],
  ["/strategy", "AI Strategy"],
  ["/social", "Social Hub"],
  ["/analytics", "Analytics"],
  ["/leads", "Leads"],
  ["/approvals", "Approvals"],
  ["/team", "Team"],
  ["/billing", "Billing"],
  ["/security", "Security"],
  ["/clients", "Clients"],
  ["/platform", "Platform Setup"],
] as const;

function initials(session: AppSession | null) {
  if (!session) return "AI";
  const source = session.name?.trim() || session.email.split("@")[0];
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function roleLabel(role?: string) {
  if (!role) return "Account";
  return role.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function AppChrome({
  children,
  session,
  workspaces,
}: {
  children: ReactNode;
  session: AppSession | null;
  workspaces: WorkspaceOption[];
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/invite/");

  if (isAuthPage) return <main className="auth-shell">{children}</main>;

  const displayName = session?.name?.trim() || session?.email.split("@")[0] || "Your profile";

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

        {session && <WorkspaceSwitcher workspaces={workspaces} />}

        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(([href, label], index) => {
            if ((href === "/clients" || href === "/platform") && !session?.platformAdmin) return null;
            if (href === "/security" && !session?.platformAdmin && session?.role !== "admin") return null;
            const active = pathname === href || pathname.startsWith(`${href}/`);

            return (
              <a
                className={active ? "active" : undefined}
                href={href}
                key={href}
                aria-current={active ? "page" : undefined}
              >
                <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
                <span>{label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-foot sidebar-foot-stack">
          <a className={`sidebar-profile ${pathname === "/profile" ? "active" : ""}`} href="/profile">
            <span className="profile-avatar">{initials(session)}</span>
            <span className="sidebar-profile-copy">
              <strong>{displayName}</strong>
              <small>{session?.email ?? roleLabel(session?.role)}</small>
            </span>
            <span className="profile-chevron" aria-hidden="true">›</span>
          </a>
          <div className="safe-mode"><span className="status-dot" /> Human-approved automation</div>
          <form action="/api/auth/logout" method="post">
            <button className="logout-button" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="shell">{children}</main>
    </>
  );
}
