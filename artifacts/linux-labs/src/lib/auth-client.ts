import { createAuthClient } from "better-auth/react";

// The Vite dev server proxies /api → http://localhost:8080, so Better Auth
// endpoints at /api/auth/* are reachable relative to the current origin.
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});

export const { useSession, signIn, signUp, signOut } = authClient;
