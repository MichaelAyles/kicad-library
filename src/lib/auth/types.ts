/**
 * The signed-in user as the app sees it, whichever provider is behind it.
 * `id` is always our Supabase uuid (profiles.id), never a provider id.
 */
export interface AppUser {
  id: string;
  email: string | null;
  /** Display name, if the provider knows one */
  name: string | null;
  /** GitHub login when signed in with GitHub (Supabase only); display only */
  username?: string | null;
  avatarUrl: string | null;
  /** From a claim only the server can set (app_metadata / WorkOS metadata) */
  isAdmin: boolean;
}

export interface SignInOptions {
  /** Same-origin path to return to after signing in (WorkOS only) */
  returnTo?: string;
}

export interface AuthContextValue {
  user: AppUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  /** Start sign-in (WorkOS: hosted AuthKit page; Supabase: /login) */
  signIn: (opts?: SignInOptions) => Promise<void>;
  /** Start sign-up (WorkOS: hosted AuthKit page; Supabase: /signup) */
  signUp: (opts?: SignInOptions) => Promise<void>;
  signOut: () => Promise<void>;
  // Supabase-only flows (undefined when built for WorkOS, where the hosted
  // AuthKit pages handle passwords, GitHub, Google and password resets)
  signInWithGitHub?: () => Promise<void>;
  signInWithEmail?: (email: string, password: string) => Promise<void>;
  signUpWithEmail?: (
    email: string,
    password: string,
    username?: string,
  ) => Promise<void>;
  resetPassword?: (email: string) => Promise<void>;
  updatePassword?: (newPassword: string) => Promise<void>;
}
