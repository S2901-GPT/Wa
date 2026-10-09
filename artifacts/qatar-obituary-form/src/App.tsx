import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from 'sonner';
import { FlaskConical } from 'lucide-react';
import NotFound from '@/pages/not-found';
import {
  Link,
  Route,
  Switch,
  useLocation,
  useRoute,
  Router as WouterRouter,
} from 'wouter';
import FormPage from '@/pages/form';
import SuccessPage from '@/pages/success';
import AdminPage from '@/pages/admin';
import AdminRequestDetailsPage from '@/pages/admin/request-details';
import AdminEditRequestPage from '@/pages/admin/edit-request';
import AdminSettingsPage from '@/pages/admin/settings';
import AdminFromTextPage from '@/pages/admin/from-text';
import AdminLabHubPage from '@/pages/admin/lab';
import AdminLabPosterPage from '@/pages/admin/lab/poster';
import { AdminGate } from '@/components/admin-gate';
import { RequestsScopeProvider, type RequestsScope } from '@/lib/requests-api';

const queryClient = new QueryClient();

/** صفحة للمسؤول فقط، بعد تسجيل الدخول. */
const guarded = (Page: () => ReactNode) => () => (
  <AdminGate>
    <Page />
  </AdminGate>
);
const GuardedAdminLabHubPage = guarded(AdminLabHubPage);
const GuardedAdminLabPosterPage = guarded(AdminLabPosterPage);

/**
 * لوحة المسؤول كاملة بمسارات نسبية، فتُركَّب مرتين: على /admin (الطلبات الحية) وعلى /admin/lab/admin
 * (طلبات التجارب). الصفحات نفسها، والنطاق يحدد أي واجهة برمجية تستدعي.
 */
function AdminArea({ scope }: { scope: RequestsScope }) {
  return (
    <AdminGate>
      <RequestsScopeProvider scope={scope}>
        <Switch>
          <Route path="/" component={AdminPage} />
          <Route path="/settings" component={AdminSettingsPage} />
          <Route path="/from-text" component={AdminFromTextPage} />
          <Route path="/:requestNumber" component={AdminRequestDetailsPage} />
          <Route path="/:requestNumber/edit" component={AdminEditRequestPage} />
          <Route component={NotFound} />
        </Switch>
      </RequestsScopeProvider>
    </AdminGate>
  );
}

/** شريط يُذكّر بأن هذه لوحة التجارب لا الموقع؛ خارج التعشيش فروابطه مطلقة. */
function LabBanner() {
  const [inLab] = useRoute('/admin/lab/admin/*?');
  if (!inLab) return null;
  return (
    <div className="sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <FlaskConical className="h-4 w-4" />
      <span>نسخة تجارب — لا تؤثر على الموقع</span>
      <Link href="/admin/lab" className="underline underline-offset-2">مركز التجارب</Link>
    </div>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <LabBanner />
      <Switch>
        <Route path="/" component={FormPage} />
        <Route path="/success/:requestNumber" component={SuccessPage} />
        <Route path="/admin/lab/admin" nest>
          <AdminArea scope="lab" />
        </Route>
        <Route path="/admin/lab/poster" component={GuardedAdminLabPosterPage} />
        <Route path="/admin/lab" component={GuardedAdminLabHubPage} />
        <Route path="/admin" nest>
          <AdminArea scope="live" />
        </Route>
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
