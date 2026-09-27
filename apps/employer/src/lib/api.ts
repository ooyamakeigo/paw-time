import type {
  Application,
  AttendanceEvent,
  AttendanceSummary,
  AuditLogEntry,
  ClosedPeriod,
  Evaluation,
  GameWorld,
  InsightsReport,
  Invitation,
  JobPosting,
  Letter,
  Member,
  RewardGrant,
  Shift,
  ShopFeedbackSummary,
  Store,
  StoreSettings,
  WorkerHistory,
} from "@paw-time/api-contracts";
import { getSession } from "./session";

const apiUrl = process.env.PAW_TIME_API_URL ?? "http://localhost:8787";
const organizationId = process.env.PAW_TIME_ORGANIZATION_ID ?? "org-komorebi";

type ApiResponse<T> = { data: T };

export type MutationResult<T> = { ok: true; data: T } | { ok: false; code: string };

async function businessHeaders(): Promise<Record<string, string>> {
  const { actorId } = await getSession();
  return { "x-organization-id": organizationId, "x-actor-id": actorId };
}

async function getBusinessData<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}/v1/business${path}`, {
      headers: await businessHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as ApiResponse<T>;
    return payload.data;
  } catch {
    return null;
  }
}

async function mutate<T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown, headers?: Record<string, string>): Promise<MutationResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      method,
      headers: { ...(headers ?? (await businessHeaders())), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "network_error" };
  }
  const payload = (await response.json().catch(() => null)) as
    | Partial<ApiResponse<T>> & { error?: string }
    | null;
  if (!response.ok || !payload || payload.data === undefined) {
    return { ok: false, code: payload?.error ?? "unknown" };
  }
  return { ok: true, data: payload.data };
}

export function postBusiness<T>(path: string, body?: unknown): Promise<MutationResult<T>> {
  return mutate<T>("POST", `/v1/business${path}`, body);
}

export function putBusiness<T>(path: string, body?: unknown): Promise<MutationResult<T>> {
  return mutate<T>("PUT", `/v1/business${path}`, body);
}

export function deleteBusiness<T>(path: string): Promise<MutationResult<T>> {
  return mutate<T>("DELETE", `/v1/business${path}`);
}

/** The shop's tablet punches on the worker's behalf, as the worker. */
export function postAsWorker<T>(workerId: string, path: string, body?: unknown): Promise<MutationResult<T>> {
  return mutate<T>("POST", `/v1/worker${path}`, body, { "x-user-id": workerId });
}

export type Me = { member: Member; members: Member[]; stores: Store[] };

export function getMe(): Promise<Me | null> {
  return getBusinessData<Me>("/me");
}

export function listStores(): Promise<Store[] | null> {
  return getBusinessData<Store[]>("/stores");
}

export function listStoreSettings(): Promise<StoreSettings[] | null> {
  return getBusinessData<StoreSettings[]>("/stores/settings");
}

export function listJobs(): Promise<JobPosting[] | null> {
  return getBusinessData<JobPosting[]>("/jobs");
}

export function listApplications(): Promise<Application[] | null> {
  return getBusinessData<Application[]>("/applications");
}

export function listInvitations(): Promise<Invitation[] | null> {
  return getBusinessData<Invitation[]>("/invitations");
}

export function listShifts(): Promise<Shift[] | null> {
  return getBusinessData<Shift[]>("/shifts");
}

export function listAttendanceSummaries(): Promise<AttendanceSummary[] | null> {
  return getBusinessData<AttendanceSummary[]>("/attendance-summaries");
}

export function listAttendanceEvents(): Promise<AttendanceEvent[] | null> {
  return getBusinessData<AttendanceEvent[]>("/attendance-events");
}

export function listClosedPeriods(): Promise<ClosedPeriod[] | null> {
  return getBusinessData<ClosedPeriod[]>("/closed-periods");
}

export function listWorkerHistories(): Promise<WorkerHistory[] | null> {
  return getBusinessData<WorkerHistory[]>("/workers");
}

export function listEvaluations(): Promise<Evaluation[] | null> {
  return getBusinessData<Evaluation[]>("/evaluations");
}

export function listLetters(): Promise<Letter[] | null> {
  return getBusinessData<Letter[]>("/letters");
}

export function listShopFeedbackSummaries(): Promise<ShopFeedbackSummary[] | null> {
  return getBusinessData<ShopFeedbackSummary[]>("/shop-feedback/summary");
}

export function getInsights(storeId: string | null, days: number): Promise<InsightsReport | null> {
  const query = new URLSearchParams({ days: String(days) });
  if (storeId) query.set("storeId", storeId);
  return getBusinessData<InsightsReport>(`/insights?${query.toString()}`);
}

export function listAuditLogs(): Promise<AuditLogEntry[] | null> {
  return getBusinessData<AuditLogEntry[]>("/audit-logs");
}

export function getEmployerWorld(): Promise<GameWorld | null> {
  return getBusinessData<GameWorld>("/world");
}

export function listRewards(): Promise<RewardGrant[] | null> {
  return getBusinessData<RewardGrant[]>("/world/rewards");
}
