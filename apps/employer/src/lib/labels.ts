import type { AttendanceEvent, AttendanceSummary } from "@paw-time/api-contracts";
import { fill, type Messages } from "./i18n/messages";

/** Codes stored in an evaluation's `tags`; the screen shows them in its language. */
export const evaluationTagCodes = [
  "on_time",
  "careful",
  "smile",
  "efficient",
  "teamwork",
  "come_again",
] as const;

export function evaluationTagLabel(code: string, m: Messages): string {
  return m.labels.evaluationTag[code] ?? code;
}

export function islandItemLabel(item: string, m: Messages): string {
  return m.labels.islandItem[item] ?? item;
}

export function punctualityLabel(summary: AttendanceSummary | undefined, m: Messages): string | null {
  if (!summary || summary.punctuality === "pending") return null;
  return summary.punctuality === "on_time" ? m.labels.onTime : fill(m.labels.late, { minutes: summary.minutesLate });
}

export function attendanceKindLabel(kind: AttendanceEvent["kind"], m: Messages): string {
  return m.labels.attendanceKind[kind];
}

export function sourceLabel(source: AttendanceEvent["source"], m: Messages): string {
  return m.labels.source[source];
}

/** The warnings a shift carries, in the order they should be shown. */
export function attendanceAlerts(summary: AttendanceSummary | undefined, m: Messages): string[] {
  if (!summary) return [];
  const alerts: string[] = [];
  if (summary.missingPunch === "check_in") alerts.push(m.attendance.alerts.missingCheckIn);
  if (summary.missingPunch === "check_out") alerts.push(m.attendance.alerts.missingCheckOut);
  if (summary.breakShortfallMinutes > 0) {
    alerts.push(fill(m.attendance.alerts.breakShortfall, { minutes: summary.breakShortfallMinutes }));
  }
  return alerts;
}

export function auditActionLabel(action: string, m: Messages): string {
  return m.audit.actions[action] ?? action;
}

export function auditEntityLabel(entityType: string, m: Messages): string {
  return m.audit.entity[entityType] ?? entityType;
}
