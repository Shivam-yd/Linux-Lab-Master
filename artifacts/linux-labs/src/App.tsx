import { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';

import Home from '@/pages/home';
import Catalog from '@/pages/catalog';
import Workspace from '@/pages/workspace';
import About from '@/pages/about';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains. Do not inline the env var, leave
// publishableKey undefined, or replace publishableKeyFromHost with anything else.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev (Clerk hits dev FAPI directly), auto-set
// in prod. Do NOT gate on import.meta.env.PROD / NODE_ENV — the empty dev value
// is intentional, and any branching breaks the prod proxy.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * True when Clerk is configured (Replit / any deployment with Clerk keys).
 * False in self-hosted mode where the backend uses cookie-based guest auth.
 */
export const hasClerk = !!clerkPubKey;

// Clerk passes full paths to routerPush/routerReplace, but wouter's
// setLocation prepends the base — strip it to avoid doubling.
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(170 80% 50%)',
    colorForeground: 'hsl(210 40% 98%)',
    colorMutedForeground: 'hsl(215 20% 65%)',
    colorDanger: 'hsl(0 80% 60%)',
    colorBackground: 'hsl(225 25% 9%)',
    colorInput: 'hsl(225 20% 15%)',
    colorInputForeground: 'hsl(210 40% 98%)',
    colorNeutral: 'hsl(225 20% 15%)',
    fontFamily: "'Outfit', sans-serif",
    borderRadius: '0.5rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(225,25%,9%)] border border-[hsl(225,20%,15%)] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_0_40px_rgba(45,212,191,0.08)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[hsl(210,40%,98%)] font-bold',
    headerSubtitle: 'text-[hsl(215,20%,65%)]',
    socialButtonsBlockButtonText: 'text-[hsl(210,40%,98%)] font-medium',
    formFieldLabel: 'text-[hsl(210,40%,98%)] font-medium',
    footerActionLink: 'text-[hsl(170,80%,50%)] font-semibold hover:text-[hsl(170,80%,60%)]',
    footerActionText: 'text-[hsl(215,20%,65%)]',
    dividerText: 'text-[hsl(215,20%,65%)]',
    identityPreviewEditButton: 'text-[hsl(170,80%,50%)]',
    formFieldSuccessText: 'text-[hsl(170,80%,50%)]',
    alertText: 'text-[hsl(210,40%,98%)]',
    logoBox: 'mb-2',
    logoImage: 'h-9 w-9',
    socialButtonsBlockButton: 'border border-[hsl(225,20%,15%)] hover:bg-[hsl(225,20%,15%)] transition-colors',
    formButtonPrimary: 'bg-[hsl(170,80%,50%)] text-[hsl(225,30%,6%)] font-bold hover:opacity-90 transition-opacity',
    formFieldInput: 'bg-[hsl(225,20%,15%)] border border-[hsl(225,20%,15%)] text-[hsl(210,40%,98%)]',
    footerAction: 'gap-1',
    dividerLine: 'bg-[hsl(225,20%,15%)]',
    alert: 'bg-[hsl(0,80%,60%)]/10 border border-[hsl(0,80%,60%)]/30',
    otpCodeFieldInput: 'bg-[hsl(225,20%,15%)] border border-[hsl(225,20%,15%)] text-[hsl(210,40%,98%)]',
    formFieldRow: '',
    main: '',
  },
};

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-destructive">404 - Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">The page you requested doesn't exist.</p>
      </div>
    </div>
  );
}

// ── Clerk mode ────────────────────────────────────────────────────────────────

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function Protected({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkRouter() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard" component={Catalog} />
      <Route path="/labs/:labId" component={Workspace} />
      <Route path="/about" component={About} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Welcome back',
            subtitle: 'Sign in to pick up your labs where you left off',
          },
        },
        signUp: {
          start: {
            title: 'Create your account',
            subtitle: 'Track your progress across every lab and track',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <ClerkRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// ── Guest mode (self-hosted, no Clerk keys) ───────────────────────────────────

function GuestRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Switch>
          <Route path="/" component={() => <Redirect to="/dashboard" />} />
          <Route path="/dashboard" component={Catalog} />
          <Route path="/labs/:labId" component={Workspace} />
          <Route path="/about" component={About} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <WouterRouter base={basePath}>
      {hasClerk ? <ClerkProviderWithRoutes /> : <GuestRouter />}
    </WouterRouter>
  );
}

export default App;
