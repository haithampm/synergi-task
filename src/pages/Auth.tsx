import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Lock, Mail, User as UserIcon, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseConfigStatus } from "@/integrations/supabase/client";
import { isPasswordRecoveryMode } from "@/lib/auth-recovery";
import { getAuthErrorMessage, getSafeRedirectPath, isInAppBrowser } from "@/lib/auth-ui";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const supabaseConfig = getSupabaseConfigStatus();
  const recoveryMode = useMemo(
    () => isPasswordRecoveryMode(window.location.search, window.location.hash),
    [],
  );
  const inAppBrowser = useMemo(() => isInAppBrowser(), []);
  const redirectPath = useMemo(
    () => getSafeRedirectPath(window.location.search, ""),
    [],
  );
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const {
    signIn,
    signUp,
    signInWithGoogle,
    sendPasswordResetEmail,
    updatePassword,
  } = useAuth();

  useEffect(() => {
    if (recoveryMode) {
      setIsSignUp(false);
    }
  }, [recoveryMode]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorDescription = hashParams.get("error_description");
    const errorCode = hashParams.get("error_code");
    if (!errorDescription) return;

    toast.error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));

    const nextUrl = new URL(window.location.href);
    nextUrl.hash = "";
    if (errorCode && !nextUrl.searchParams.get("auth_error")) {
      nextUrl.searchParams.set("auth_error", errorCode);
    }
    window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (recoveryMode) {
        if (!password.trim()) {
          throw new Error("Enter a new password.");
        }
        if (password.length < 6) {
          throw new Error("New password must be at least 6 characters.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        await updatePassword(password);
        const nextUrl = redirectPath ? `/auth?redirect=${encodeURIComponent(redirectPath)}` : "/auth";
        window.history.replaceState({}, document.title, nextUrl);
        toast.success("Password updated. You can continue to your workspace.");
        navigate(redirectPath || "/", { replace: true });
        return;
      }

      if (isSignUp) {
        await signUp(email, password, fullName);
        toast.success("Account created! Check your email to verify.");
      } else {
        await signIn(email, password);
        toast.success("Welcome back!");
        navigate(redirectPath || "/", { replace: true });
      }
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(email.trim());
      toast.success("Password reset email sent. Check your inbox and spam folder.");
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Sign-in link copied.");
    } catch {
      toast.error("Could not copy the link from this browser.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-hero">
      <Card className="w-full max-w-md border-border/50 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">AI Project Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {recoveryMode
              ? "Set your new password"
              : isSignUp
                ? "Create your account"
                : "Sign in to your workspace"}
          </p>
        </CardHeader>
        <CardContent>
          {!supabaseConfig.isOperational && (
            <div className="mb-5 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-left">
              <p className="text-sm font-medium text-destructive">Database configuration needs attention</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {supabaseConfig.issues[0] ?? "Supabase is not ready yet."}
              </p>
              {(supabaseConfig.linkedProjectRef || supabaseConfig.activeProjectRef) && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Linked project: {supabaseConfig.linkedProjectRef ?? "not set"} | App project: {supabaseConfig.activeProjectRef ?? "not set"}
                </p>
              )}
            </div>
          )}

          {inAppBrowser && !recoveryMode && (
            <div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-left">
              <p className="text-sm font-medium text-foreground">Embedded browser detected</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Google sign-in can be blocked inside in-app browsers. If Google does not continue, open this page in Chrome or Safari and try again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleCopyLink}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy sign-in link
                </Button>
              </div>
            </div>
          )}

          {redirectPath && !recoveryMode && (
            <div className="mb-5 rounded-2xl border border-border/60 bg-muted/30 p-4 text-left">
              <p className="text-sm font-medium text-foreground">Sign in required</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Sign in to continue to <span className="font-medium text-foreground">{redirectPath}</span>.
              </p>
            </div>
          )}

          {!isSignUp && !recoveryMode && (
            <div className="space-y-3 mb-5">
              <Button type="button" variant="outline" className="w-full" disabled={googleLoading} onClick={handleGoogleSignIn}>
                <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold">G</span>
                {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
                {!googleLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Use your Google account for profile access, or sign in with email and password below.
              </p>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !recoveryMode && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" />
              </div>
            )}

            {!recoveryMode && (
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            )}

            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder={recoveryMode ? "New password" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                minLength={6}
              />
            </div>

            {recoveryMode && (
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            )}

            {!isSignUp && !recoveryMode && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? "Sending reset link..." : "Forgot password?"}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-glow" disabled={loading}>
              {loading
                ? "Loading..."
                : recoveryMode
                  ? "Update Password"
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {recoveryMode ? (
              <button
                type="button"
                onClick={() => {
                  const nextUrl = redirectPath ? `/auth?redirect=${encodeURIComponent(redirectPath)}` : "/auth";
                  window.history.replaceState({}, document.title, nextUrl);
                  window.location.reload();
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to sign in
              </button>
            ) : (
              <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
