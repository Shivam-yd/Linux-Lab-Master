import { Component, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state;
    if (error) return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: '#f87171', background: '#0d0d0d', minHeight: '100vh' }}>
        <h2 style={{ marginBottom: 12 }}>Something went wrong</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{(error as Error).message}</pre>
      </div>
    );
    return this.props.children;
  }
}

import Home from '@/pages/home';
import Catalog from '@/pages/catalog';
import Workspace from '@/pages/workspace';
import About from '@/pages/about';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';
import ProgressPage from '@/pages/progress';
import ProfilePage from '@/pages/profile';
import CertificatePage from '@/pages/certificate';
import VerifyPage from '@/pages/verify';
import AdminPage from '@/pages/admin';
import BillingAdmin from '@/pages/billing-admin';
import ForgotPasswordPage from '@/pages/forgot-password';
import ResetPasswordPage from '@/pages/reset-password';
import TermsPage from '@/pages/terms';
import PricingPage from '@/pages/pricing';
import ChoosePlan from '@/pages/choose-plan';
import PrivacyPage from '@/pages/privacy';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-muted-foreground">Page not found</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      <WouterRouter base={basePath}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/dashboard" component={Catalog} />
              <Route path="/labs/:labId" component={Workspace} />
              <Route path="/about" component={About} />
              <Route path="/sign-in" component={SignInPage} />
              <Route path="/sign-up" component={SignUpPage} />
              <Route path="/progress" component={ProgressPage} />
              <Route path="/profile" component={ProfilePage} />
              <Route path="/certificate/:track/level/:level" component={CertificatePage} />
              <Route path="/certificate/:track" component={CertificatePage} />
              <Route path="/verify/:certId" component={VerifyPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/admin/billing" component={BillingAdmin} />
              <Route path="/forgot-password" component={ForgotPasswordPage} />
              <Route path="/reset-password" component={ResetPasswordPage} />
              <Route path="/choose-plan" component={ChoosePlan} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/terms" component={TermsPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route component={NotFound} />
            </Switch>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </WouterRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
