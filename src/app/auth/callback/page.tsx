"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AUTH_PROVIDER } from "@/lib/auth/config";
import { waitForSupabaseSession } from "@/lib/auth/SupabaseAuthProvider";

// If nothing has moved us on by then, give up waiting and go home
const WORKOS_TIMEOUT_MS = 15_000;

function Spinner({ message }: { message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <Loader className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p>{message}</p>
      </div>
    </div>
  );
}

/**
 * Supabase: the browser client uses the PKCE flow and exchanges the `?code=`
 * in the URL for a session while it initialises (detectSessionInUrl), using
 * the code verifier it stored when sign-in started. getSession() waits for
 * that, so all this page does is wait and then send the user on.
 */
function SupabaseCallback() {
  const router = useRouter();
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") || params.get("error_description")) {
        router.replace("/login?error=auth_failed");
        return;
      }

      const { signedIn, error } = await waitForSupabaseSession();
      if (cancelled) return;

      if (!signedIn) {
        if (error) console.error("Sign-in failed:", error);
        setMessage("Sign-in failed. Redirecting...");
        router.replace(
          params.get("code") ? "/login?error=auth_failed" : "/login",
        );
        return;
      }

      router.replace("/");
    }

    finish();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return <Spinner message={message} />;
}

/**
 * WorkOS: AuthKitProvider exchanges the `?code=` itself and then navigates
 * (onRedirectCallback, to the same-origin returnTo or "/"). This page only
 * covers the cases where that doesn't happen: an error from AuthKit, a
 * failed exchange, or a visit without a code.
 */
function WorkOSCallback() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      console.error(
        "Sign-in failed:",
        params.get("error_description") || params.get("error"),
      );
      setFailure("Sign-in didn't complete.");
    }
  }, []);

  useEffect(() => {
    // Signed-in success is left to onRedirectCallback, which knows returnTo
    if (!failure && !isLoading && !user) router.replace("/");
  }, [failure, isLoading, user, router]);

  useEffect(() => {
    if (failure) return;
    const timer = setTimeout(() => router.replace("/"), WORKOS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [failure, router]);

  if (failure) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center text-muted-foreground max-w-sm">
          <p className="mb-4 text-destructive">{failure}</p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </Link>
        </div>
      </div>
    );
  }

  return <Spinner message="Signing you in..." />;
}

/** OAuth / email-confirmation landing page (/auth/callback). */
export default function AuthCallbackPage() {
  return AUTH_PROVIDER === "workos" ? <WorkOSCallback /> : <SupabaseCallback />;
}
