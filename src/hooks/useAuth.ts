import { useState, useEffect } from 'react';
import {
  getPrimarySupabaseConfigIssue,
  isSupabaseOperational,
  supabase,
} from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

const ensureSupabaseAuthReady = () => {
  if (isSupabaseOperational()) return;
  throw new Error(
    getPrimarySupabaseConfigIssue() ??
      "Supabase authentication is unavailable until the project configuration is fixed.",
  );
};

const buildAuthRedirectUrl = (path = "/auth") => `${window.location.origin}${path}`;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseOperational()) {
      setLoading(false);
      return () => undefined;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: buildAuthRedirectUrl(),
      },
    });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthRedirectUrl(),
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (!isSupabaseOperational()) return;
    await supabase.auth.signOut();
  };

  const updatePassword = async (password: string) => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  };

  const sendPasswordResetEmail = async (email: string) => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildAuthRedirectUrl("/auth?mode=recovery"),
    });
    if (error) throw error;
  };

  const sendInvitationEmail = async (email: string, fullName?: string) => {
    ensureSupabaseAuthReady();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildAuthRedirectUrl(),
        data: fullName ? { full_name: fullName, invitation_source: "workspace-admin" } : undefined,
      },
    });
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updatePassword,
    sendPasswordResetEmail,
    sendInvitationEmail,
  };
}
