"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * OAuth / email-confirmation landing page.
 *
 * The browser Supabase client uses the PKCE flow and exchanges the `?code=`
 * in the URL for a session while it initialises (detectSessionInUrl), using
 * the code verifier it stored when sign-in started. getSession() waits for
 * that, so all this page does is wait and then send the user on.
 */
export default function AuthCallbackPage() {
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

      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session) {
        if (error) console.error("Sign-in failed:", error.message);
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

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <Loader className="w-8 h-8 animate-spin mx-auto mb-3" />
        <p>{message}</p>
      </div>
    </div>
  );
}
