"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase-client";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  passwordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return "Supabase Auth is not configured.";
    const { error } = await client.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return "Supabase Auth is not configured.";
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return error?.message ?? null;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return "Supabase Auth is not configured.";
    const redirectTo = `${window.location.origin}/update-password`;
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
    return error?.message ?? null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const client = getSupabaseBrowserClient();
    if (!client) return "Supabase Auth is not configured.";
    const { error } = await client.auth.updateUser({ password });
    if (!error) setPasswordRecovery(false);
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await getSupabaseBrowserClient()?.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ configured, loading, session, user: session?.user ?? null, passwordRecovery, signIn, signUp, requestPasswordReset, updatePassword, signOut }),
    [configured, loading, passwordRecovery, requestPasswordReset, session, signIn, signOut, signUp, updatePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
