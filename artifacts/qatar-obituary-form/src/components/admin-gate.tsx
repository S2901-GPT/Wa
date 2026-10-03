// بوابة لوحة الإدارة: لا يُعرض أي شيء من صفحات المسؤول قبل تسجيل الدخول. التحقق الفعلي في الخادم
// (كل طلب محمي يحمل جلسة موقّعة)، وهذه الشاشة تعرض فقط نتيجة ذلك.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ADMIN_UNAUTHORIZED_EVENT,
  ApiError,
  getGetAdminSessionQueryKey,
  useAdminLogin,
  useGetAdminSession,
  type AdminSession,
} from "@workspace/api-client-react";
import { AlertCircle, KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string } | null;
    if (data?.error) return data.error;
    if (error.status === 401) return "كلمة المرور غير صحيحة";
    if (error.status === 429) return "محاولات خاطئة كثيرة، حاول بعد قليل.";
  }
  return "تعذر الاتصال بالخادم، حاول مرة أخرى.";
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm shadow-lg">
        <CardContent className="p-6 sm:p-8">{children}</CardContent>
      </Card>
    </div>
  );
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (session: AdminSession) => void }) {
  const [password, setPassword] = useState("");
  const login = useAdminLogin();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!password || login.isPending) return;
    login.mutate({ data: { password } }, { onSuccess: onLoggedIn });
  };

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-full bg-primary/10 p-3 text-primary"><KeyRound className="h-6 w-6" /></div>
          <h1 className="text-xl font-bold text-foreground">لوحة الإدارة</h1>
          <p className="text-sm text-muted-foreground">أدخل كلمة مرور المسؤول للمتابعة</p>
        </div>
        <Input
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="كلمة المرور"
          aria-label="كلمة مرور المسؤول"
          dir="ltr"
          className="text-center"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {login.isError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage(login.error)}
          </p>
        )}
        <Button type="submit" className="w-full h-11" disabled={!password || login.isPending}>
          {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "دخول"}
        </Button>
      </form>
    </Shell>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = useGetAdminSession({ query: { queryKey: getGetAdminSessionQueryKey(), retry: false, staleTime: 0, refetchOnWindowFocus: true } });

  // أي طلب محمي يرد 401 (انتهت الجلسة): نعود إلى شاشة الدخول فوراً.
  useEffect(() => {
    const onUnauthorized = () => queryClient.setQueryData<AdminSession>(getGetAdminSessionQueryKey(), { authenticated: false, configured: true });
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  if (session.isLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-9 w-9 animate-spin text-primary" /></div>;
  }

  if (session.isError || !session.data) {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">تعذر التحقق من جلسة المسؤول.</p>
          <Button variant="outline" onClick={() => void session.refetch()}>إعادة المحاولة</Button>
        </div>
      </Shell>
    );
  }

  if (!session.data.configured) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <div className="mx-auto w-fit rounded-full bg-amber-100 p-3 text-amber-700"><Lock className="h-6 w-6" /></div>
          <h1 className="text-lg font-bold text-foreground">لوحة الإدارة مقفلة</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            لم تُضبط كلمة مرور المسؤول في الخادم بعد (أو أنها أقصر من 8 أحرف). اضبط المتغير <code dir="ltr" className="rounded bg-muted px-1">ADMIN_PASSWORD</code> في إعدادات الخدمة ثم أعد تحميل الصفحة.
          </p>
        </div>
      </Shell>
    );
  }

  if (!session.data.authenticated) {
    return <LoginForm onLoggedIn={(next) => { queryClient.setQueryData(getGetAdminSessionQueryKey(), next); void queryClient.invalidateQueries(); }} />;
  }

  return <>{children}</>;
}
