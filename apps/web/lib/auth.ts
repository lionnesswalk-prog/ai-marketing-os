export type AppRole = "admin" | "marketing_manager" | "sales" | "viewer";

export type AppSession = {
  email: string;
  role: AppRole;
};

export function getSession(): AppSession {
  // Development session only. Replace with a production identity provider before public launch.
  const role = (process.env.DEV_USER_ROLE ?? "admin") as AppRole;
  return {
    email: process.env.DEV_USER_EMAIL ?? "owner@example.com",
    role,
  };
}

export function canDecideApprovals(role: AppRole) {
  return role === "admin" || role === "marketing_manager";
}
