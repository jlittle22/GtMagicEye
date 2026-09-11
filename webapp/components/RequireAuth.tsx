"use client";

import { useEffect, type ReactNode } from "react";
import { useAuth } from "../lib/AuthContext";

// Gates dashboard pages behind login. Renders nothing — not even a flash of
// children — until auth has both loaded from localStorage (ready) and
// confirmed a user is present; an unauthenticated visitor is sent to /login
// (server/public/login.html, same origin — see server/index.js) instead.
// window.location is used rather than next/navigation's router because
// /login isn't a Next.js route, it's served by the Express app in front of
// this one.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && !user) {
      const redirect = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
    }
  }, [ready, user]);

  if (!ready || !user) return null;

  return <>{children}</>;
}
