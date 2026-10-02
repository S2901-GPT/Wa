import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';
import FormPage from '@/pages/form';
import SuccessPage from '@/pages/success';
import AdminPage from '@/pages/admin';
import AdminTemplatesPage from '@/pages/admin/templates';
import AdminRequestDetailsPage from '@/pages/admin/request-details';
import AdminEditRequestPage from '@/pages/admin/edit-request';

const queryClient = new QueryClient();

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={FormPage} />
        <Route path="/success/:requestNumber" component={SuccessPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/admin/templates" component={AdminTemplatesPage} />
        <Route path="/admin/:requestNumber" component={AdminRequestDetailsPage} />
        <Route path="/admin/:requestNumber/edit" component={AdminEditRequestPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <div dir="rtl" className="min-h-[100dvh] flex flex-col font-sans antialiased text-foreground bg-background">
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL && import.meta.env.BASE_URL !== '/' ? import.meta.env.BASE_URL.replace(/\/$/, '') : undefined}>
          <Router />
        </WouterRouter>
        <Toaster position="top-center" richColors />
      </QueryClientProvider>
    </div>
  );
}

export default App;
