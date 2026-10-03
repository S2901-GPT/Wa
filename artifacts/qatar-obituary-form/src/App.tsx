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
import AdminRequestDetailsPage from '@/pages/admin/request-details';
import AdminEditRequestPage from '@/pages/admin/edit-request';
import AdminSettingsPage from '@/pages/admin/settings';
import AdminFromTextPage from '@/pages/admin/from-text';
import { AdminGate } from '@/components/admin-gate';

const queryClient = new QueryClient();

/** صفحات المسؤول لا تُعرض إلا بعد تسجيل الدخول. */
const guarded = (Page: () => ReactNode) => () => (
  <AdminGate>
    <Page />
  </AdminGate>
);
const GuardedAdminPage = guarded(AdminPage);
const GuardedAdminSettingsPage = guarded(AdminSettingsPage);
const GuardedAdminFromTextPage = guarded(AdminFromTextPage);
const GuardedAdminRequestDetailsPage = guarded(AdminRequestDetailsPage);
const GuardedAdminEditRequestPage = guarded(AdminEditRequestPage);

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={FormPage} />
        <Route path="/success/:requestNumber" component={SuccessPage} />
        <Route path="/admin" component={GuardedAdminPage} />
        <Route path="/admin/settings" component={GuardedAdminSettingsPage} />
        <Route path="/admin/from-text" component={GuardedAdminFromTextPage} />
        <Route path="/admin/:requestNumber" component={GuardedAdminRequestDetailsPage} />
        <Route path="/admin/:requestNumber/edit" component={GuardedAdminEditRequestPage} />
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
