import type { Application, AttendanceSummary, JobPosting, Shift } from "@paw-time/api-contracts";
import { dayOfMonth, daysInMonth, monthKey } from "./format";

/** Confirmed pay is from completed shifts; the rest is a projection. */
export type PayKind = "confirmed" | "awaiting" | "forecast";

export type PayLine = {
  shift: Shift;
  job: JobPosting | undefined;
  workerName: string;
  kind: PayKind;
  amount: number;
  workedMinutes: number;
};

/** Labor Standards Act art. 34: 45 min over 6 h, 60 min over 8 h. */
const BREAK_RULES = [
  { workedOver: 8 * 60, requiredBreak: 60 },
  { workedOver: 6 * 60, requiredBreak: 45 },
];

export function legalBreakMinutes(workedMinutes: number): number {
  return BREAK_RULES.find((rule) => workedMinutes > rule.workedOver)?.requiredBreak ?? 0;
}

/** What a shift costs, or null when it never happened. */
export function payLine(
  shift: Shift,
  summary: AttendanceSummary | undefined,
  job: JobPosting | undefined,
  workerName: string,
): PayLine | null {
  if (shift.status === "no_show" || shift.status === "disputed") return null;
  const base = { shift, job, workerName };
  if (shift.status === "completed" || shift.status === "checked_out") {
    return {
      ...base,
      kind: shift.status === "completed" ? "confirmed" : "awaiting",
      amount: summary?.estimatedPay ?? 0,
      workedMinutes: summary?.workedMinutes ?? 0,
    };
  }
  const scheduledMinutes =
    summary?.scheduledMinutes ??
    Math.round((Date.parse(shift.scheduledEndAt) - Date.parse(shift.scheduledStartAt)) / 60_000);
  const paidMinutes = Math.max(0, scheduledMinutes - legalBreakMinutes(scheduledMinutes));
  return { ...base, kind: "forecast", amount: Math.round(((job?.hourlyWage ?? 0) * paidMinutes) / 60), workedMinutes: 0 };
}

export type PayrollDay = { day: number; confirmed: number; projected: number; total: number };
export type PayrollWorker = {
  workerId: string;
  name: string;
  shifts: number;
  workedMinutes: number;
  confirmed: number;
  projected: number;
  total: number;
};

export type MonthPayroll = {
  month: string;
  lines: PayLine[];
  totals: Record<PayKind, number> & { all: number };
  counts: Record<PayKind, number>;
  days: PayrollDay[];
  workers: PayrollWorker[];
};

export function monthPayroll(
  month: string,
  shifts: Shift[],
  summaries: AttendanceSummary[],
  jobs: JobPosting[],
  applications: Application[],
  fallbackName: string,
): MonthPayroll {
  const lines = shifts
    .filter((shift) => monthKey(shift.scheduledStartAt) === month)
    .map((shift) =>
      payLine(
        shift,
        summaries.find((summary) => summary.shiftId === shift.id),
        jobs.find((job) => job.id === shift.jobPostingId),
        applications.find((application) => application.id === shift.applicationId)?.workerDisplayName ?? fallbackName,
      ),
    )
    .filter((line): line is PayLine => line !== null)
    .sort((left, right) => Date.parse(left.shift.scheduledStartAt) - Date.parse(right.shift.scheduledStartAt));

  const totals = { confirmed: 0, awaiting: 0, forecast: 0, all: 0 };
  const counts = { confirmed: 0, awaiting: 0, forecast: 0 };
  const days: PayrollDay[] = Array.from({ length: daysInMonth(month) }, (_, index) => ({
    day: index + 1,
    confirmed: 0,
    projected: 0,
    total: 0,
  }));
  const workers = new Map<string, PayrollWorker>();

  for (const line of lines) {
    totals[line.kind] += line.amount;
    totals.all += line.amount;
    counts[line.kind] += 1;
    const day = days[dayOfMonth(line.shift.scheduledStartAt) - 1];
    const worker = workers.get(line.shift.workerId) ?? {
      workerId: line.shift.workerId,
      name: line.workerName,
      shifts: 0,
      workedMinutes: 0,
      confirmed: 0,
      projected: 0,
      total: 0,
    };
    worker.shifts += 1;
    worker.workedMinutes += line.workedMinutes;
    worker.total += line.amount;
    if (day) day.total += line.amount;
    if (line.kind === "confirmed") {
      worker.confirmed += line.amount;
      if (day) day.confirmed += line.amount;
    } else {
      worker.projected += line.amount;
      if (day) day.projected += line.amount;
    }
    workers.set(line.shift.workerId, worker);
  }

  return {
    month,
    lines,
    totals,
    counts,
    days,
    workers: [...workers.values()].sort((left, right) => right.total - left.total),
  };
}

/** A clean axis ceiling (1, 2, 2.5, 5 × 10ⁿ) at or above the largest value, split into four ticks. */
export function niceScale(max: number): { ceiling: number; ticks: number[] } {
  if (max <= 0) return { ceiling: 4, ticks: [0, 1, 2, 3, 4] };
  const rawStep = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep) ?? 10 * magnitude;
  const ceiling = step * 4;
  return { ceiling, ticks: [0, 1, 2, 3, 4].map((index) => index * step) };
}
