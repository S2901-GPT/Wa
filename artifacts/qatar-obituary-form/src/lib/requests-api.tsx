// نطاق الطلبات: الحي (/api/obituary-requests) أو التجارب (/api/lab/obituary-requests).
// صفحات المسؤول تستدعي هذه الخطافات بدل المولَّدة مباشرة، فتعمل الصفحة نفسها في اللوحة الحية وفي لوحة التجارب
// حسب المزوّد الذي تُركَّب تحته. مفاتيح الاستعلام مختلفة بين النطاقين تلقائياً، فلا يختلط ذاكرة الاثنين.
import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import {
  getCreateLabObituaryRequestMutationOptions,
  getCreateObituaryRequestMutationOptions,
  getDeleteLabObituaryRequestMutationOptions,
  getDeleteObituaryRequestMutationOptions,
  getGetLabObituaryRequestQueryKey,
  getGetLabObituaryRequestQueryOptions,
  getGetObituaryRequestQueryKey,
  getGetObituaryRequestQueryOptions,
  getListLabObituaryRequestsQueryKey,
  getListLabObituaryRequestsQueryOptions,
  getListObituaryRequestsQueryKey,
  getListObituaryRequestsQueryOptions,
  getUpdateLabObituaryRequestMutationOptions,
  getUpdateObituaryRequestMutationOptions,
  type ObituaryRequest,
  type ObituaryRequestInput,
  type ObituaryRequestUpdate,
} from "@workspace/api-client-react";

export type RequestsScope = "live" | "lab";

const RequestsScopeContext = createContext<RequestsScope>("live");

export function RequestsScopeProvider({ scope, children }: { scope: RequestsScope; children: ReactNode }) {
  return <RequestsScopeContext.Provider value={scope}>{children}</RequestsScopeContext.Provider>;
}

/** النطاق الحالي: `lab` داخل لوحة التجارب، و`live` في كل مكان آخر. */
export function useRequestsScope(): RequestsScope {
  return useContext(RequestsScopeContext);
}

/** مفاتيح الاستعلام للنطاق الحالي (للإبطال بعد الحفظ أو الحذف). */
export function useRequestKeys() {
  const scope = useRequestsScope();
  return {
    list: () => (scope === "lab" ? getListLabObituaryRequestsQueryKey() : getListObituaryRequestsQueryKey()),
    get: (requestNumber: string) => (scope === "lab" ? getGetLabObituaryRequestQueryKey(requestNumber) : getGetObituaryRequestQueryKey(requestNumber)),
  };
}

type QueryExtras<T> = { query?: Partial<Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">> };

export function useRequestsList(options?: QueryExtras<ObituaryRequest[]>): UseQueryResult<ObituaryRequest[], Error> {
  const scope = useRequestsScope();
  const base = (scope === "lab" ? getListLabObituaryRequestsQueryOptions() : getListObituaryRequestsQueryOptions()) as UseQueryOptions<ObituaryRequest[], Error, ObituaryRequest[]>;
  return useQuery({ ...base, ...options?.query, queryKey: base.queryKey });
}

export function useRequest(requestNumber: string, options?: QueryExtras<ObituaryRequest>): UseQueryResult<ObituaryRequest, Error> {
  const scope = useRequestsScope();
  const base = (scope === "lab" ? getGetLabObituaryRequestQueryOptions(requestNumber) : getGetObituaryRequestQueryOptions(requestNumber)) as UseQueryOptions<ObituaryRequest, Error, ObituaryRequest>;
  return useQuery({ ...base, ...options?.query, queryKey: base.queryKey });
}

export function useCreateRequest(): UseMutationResult<ObituaryRequest, Error, { data: ObituaryRequestInput }> {
  const scope = useRequestsScope();
  const options = scope === "lab" ? getCreateLabObituaryRequestMutationOptions() : getCreateObituaryRequestMutationOptions();
  return useMutation(options as never) as UseMutationResult<ObituaryRequest, Error, { data: ObituaryRequestInput }>;
}

export function useUpdateRequest(): UseMutationResult<ObituaryRequest, Error, { requestNumber: string; data: ObituaryRequestUpdate }> {
  const scope = useRequestsScope();
  const options = scope === "lab" ? getUpdateLabObituaryRequestMutationOptions() : getUpdateObituaryRequestMutationOptions();
  return useMutation(options as never) as UseMutationResult<ObituaryRequest, Error, { requestNumber: string; data: ObituaryRequestUpdate }>;
}

export function useDeleteRequest(): UseMutationResult<void, Error, { requestNumber: string }> {
  const scope = useRequestsScope();
  const options = scope === "lab" ? getDeleteLabObituaryRequestMutationOptions() : getDeleteObituaryRequestMutationOptions();
  return useMutation(options as never) as UseMutationResult<void, Error, { requestNumber: string }>;
}
