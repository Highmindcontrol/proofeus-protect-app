import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";

/**
 * Contexte d'authentification global de l'app.
 * Écoute les changements de session Supabase et expose les actions
 * de connexion / inscription / déconnexion.
 *
 * Chaque enfant qui a besoin de l'user peut faire `useAuth()`.
 */

export type ProtectProfil = {
  id: string;
  auth_id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  profil_type: "particulier" | "senior" | "cadre" | "entreprise" | null;
  rgpd_consent: boolean;
  enrolment_status: Record<string, unknown>;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profil: ProtectProfil | null;
};

type AuthActions = {
  signUp: (input: {
    email: string;
    password: string;
    rgpdConsent: boolean;
  }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfil: () => Promise<void>;
  updateProfil: (patch: Partial<ProtectProfil>) => Promise<{ error: string | null }>;
};

type AuthCtx = AuthState & AuthActions;

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profil, setProfil] = useState<ProtectProfil | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfil = useCallback(async (authId: string) => {
    const { data, error } = await supabase
      .from("protect_users")
      .select("*")
      .eq("auth_id", authId)
      .maybeSingle();
    if (error) {
      console.warn("[auth] fetchProfil error", error.message);
      return null;
    }
    return (data ?? null) as ProtectProfil | null;
  }, []);

  const refreshProfil = useCallback(async () => {
    if (!session?.user?.id) {
      setProfil(null);
      return;
    }
    const p = await fetchProfil(session.user.id);
    setProfil(p);
  }, [session?.user?.id, fetchProfil]);

  useEffect(() => {
    // Restauration initiale de la session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // Abonnement aux changements de session (connexion/déconnexion)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    void refreshProfil();
  }, [refreshProfil]);

  const signUp = useCallback(
    async (input: { email: string; password: string; rgpdConsent: boolean }) => {
      const { error } = await supabase.auth.signUp({
        email: input.email.toLowerCase().trim(),
        password: input.password,
        options: {
          data: { rgpd_consent: input.rgpdConsent },
        },
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfil(null);
  }, []);

  const updateProfil = useCallback(
    async (patch: Partial<ProtectProfil>) => {
      if (!session?.user?.id) return { error: "Non connecté" };
      const { error } = await supabase
        .from("protect_users")
        .update(patch)
        .eq("auth_id", session.user.id);
      if (error) return { error: error.message };
      await refreshProfil();
      return { error: null };
    },
    [session?.user?.id, refreshProfil],
  );

  const value = useMemo<AuthCtx>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profil,
      signUp,
      signIn,
      signOut,
      refreshProfil,
      updateProfil,
    }),
    [loading, session, profil, signUp, signIn, signOut, refreshProfil, updateProfil],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
