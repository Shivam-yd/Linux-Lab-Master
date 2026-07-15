import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';

import Home from '@/pages/home';
import Catalog from '@/pages/catalog';
import Workspace from '@/pages/workspace';
import About from '@/pages/about';
import SignInPage from '@/pages/sign-in';
import SignUpPage from '@/pages/sign-up';

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
            <Route component={NotFound} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
