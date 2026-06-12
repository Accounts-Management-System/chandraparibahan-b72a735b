import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const AUTH_TIMEOUT_MS = 3500;

const AuthCtx = createContext<{ user: User | null; session: Session | null; loading: boolean }>({
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let settled = false;

    const finish = (nextSession: Session | null) => {
      if (!alive) return;
      settled = true;
      setSession(nextSession);
      setLoading(false);
    };

    const fallback = window.setTimeout(() => {
      if (!settled) finish(null);
    }, AUTH_TIMEOUT_MS);

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      finish(s);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => finish(data.session))
      .catch(() => finish(null));

    return () => {
      alive = false;
      window.clearTimeout(fallback);
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
