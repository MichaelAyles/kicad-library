"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Sends the visitor to the hosted AuthKit sign-in or sign-up page (WorkOS
 * build). Used by /login and /signup, and by the password-reset pages, since
 * AuthKit handles resets itself. Signed-in visitors go to the homepage.
 */
export function HostedAuthRedirect({
  mode,
}: {
  mode: "sign-in" | "sign-up";
}) {
  const router = useRouter();
  const { user, isLoading, error, signIn, signUp } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/");
      return;
    }
    // Don't loop back to AuthKit if signing in just failed (e.g. /api/me)
    if (error || started.current) return;
    started.current = true;
    (mode === "sign-up" ? signUp() : signIn()).catch((err) =>
      console.error("Failed to start sign-in:", err),
    );
  }, [isLoading, user, error, mode, router, signIn, signUp]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center text-muted-foreground max-w-sm">
        {error ? (
          <>
            <p className="mb-4 text-destructive">{error}</p>
            <button
              type="button"
              onClick={() => (mode === "sign-up" ? signUp() : signIn())}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <Loader className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p>Redirecting to sign in...</p>
          </>
        )}
      </div>
    </div>
  );
}
