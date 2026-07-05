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
      if (!session?.user?.id || !session.user.email) {
        return { error: "Non connecté" };
      }

      // 1) UPDATE prioritaire — la ligne existe déjà (créée par le
      //    trigger SQL ou par le backfill manuel). Simple, propre,
      //    respecte les policies RLS update.
      const { data: updated, error: eUpd } = await supabase
        .from("protect_users")
        .update(patch)
        .eq("auth_id", session.user.id)
        .select("id");

      if (eUpd) return { error: eUpd.message };

      // 2) Si aucune ligne n'a été mise à jour, la ligne n'existe pas
      //    et on la crée avec INSERT (autorisé par la policy WITH CHECK
      //    tant que auth_id = auth.uid()).
      if (!updated || updated.length === 0) {
        const { error: eIns } = await supabase.from("protect_users").insert({
          auth_id: session.user.id,
          email: session.user.email,
          ...patch,
        });
        if (eIns) return { error: eIns.message };
      }

      await refreshProfil();
      return { error: null };
    },
    [session?.user?.id, session?.user?.email, refreshProfil],
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
