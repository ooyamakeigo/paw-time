import type { NextRequest } from "next/server";
import { listApplications, listAttendanceSummaries, listJobs, listShifts } from "@/lib/api";
import { createFormatters, dateKey, isMonthKey, monthKey } from "@/lib/format";
import { fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { scopeToStore } from "@/lib/scope";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Quotes a CSV cell when it needs quoting. */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvResponse(rows: Array<Array<string | number>>, asciiName: string, localizedName: string): Response {
  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n");
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(localizedName)}`,
      "cache-control": "no-store",
    },
  });
}

/**
 * One month of attendance as CSV for payroll software; Excel-friendly with a
 * BOM and CRLF. `format=daily` lists every shift with its punches;
 * `format=monthly` totals per worker.
 */
export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("month") ?? undefined;
  const month = isMonthKey(requested) ? requested : monthKey(new Date());
  const format = request.nextUrl.searchParams.get("format") === "monthly" ? "monthly" : "daily";
  const [{ locale, m }, session, allShifts, summaries, applications, allJobs] = await Promise.all([
    getMessages(),
    getSession(),
    listShifts(),
    listAttendanceSummaries(),
    listApplications(),
    listJobs(),
  ]);
  if (!allShifts || !summaries || !applications || !allJobs) {
    return new Response(m.common.apiUnavailableTitle, { status: 503 });
  }
  const { jobs, shifts } = scopeToStore(session.storeId, { jobs: allJobs, shifts: allShifts });
  const { formatTime } = createFormatters(locale);
  const monthShifts = shifts
    .filter((shift) => monthKey(shift.scheduledStartAt) === month)
    .sort((left, right) => Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt));
  const workerName = (applicationId: string) =>
    applications.find((candidate) => candidate.id === applicationId)?.workerDisplayName ?? m.attendance.fallbackWorker;

  if (format === "monthly") {
    const columns = m.attendance.export.monthlyColumns;
    const totals = new Map<string, { worker: string; shifts: number; worked: number; breaks: number; overtime: number; night: number; late: number; noShows: number; pay: number }>();
    for (const shift of monthShifts) {
      const summary = summaries.find((candidate) => candidate.shiftId === shift.id);
      const row = totals.get(shift.workerId) ?? { worker: workerName(shift.applicationId), shifts: 0, worked: 0, breaks: 0, overtime: 0, night: 0, late: 0, noShows: 0, pay: 0 };
      if (shift.status === "completed" || shift.status === "checked_out") {
        row.shifts += 1;
        row.worked += summary?.workedMinutes ?? 0;
        row.breaks += summary?.breakMinutes ?? 0;
        row.overtime += summary?.overtimeMinutes ?? 0;
        row.night += summary?.nightMinutes ?? 0;
        row.late += summary?.punctuality === "late" ? 1 : 0;
        row.pay += summary?.estimatedPay ?? 0;
      }
      if (shift.status === "no_show") row.noShows += 1;
      totals.set(shift.workerId, row);
    }
    const rows: Array<Array<string | number>> = [
      [columns.worker, columns.shifts, columns.workedMinutes, columns.breakMinutes, columns.overtimeMinutes, columns.nightMinutes, columns.lateShifts, columns.noShows, columns.estimatedPay],
      ...[...totals.values()].map((row) => [row.worker, row.shifts, row.worked, row.breaks, row.overtime, row.night, row.late, row.noShows, row.pay]),
    ];
    return csvResponse(rows, `attendance_totals_${month}.csv`, fill(m.attendance.export.filenameMonthly, { month }));
  }

  const columns = m.attendance.export.columns;
  const rows: Array<Array<string | number>> = [
    [
      columns.date,
      columns.worker,
      columns.job,
      columns.plannedStart,
      columns.plannedEnd,
      columns.checkIn,
      columns.checkOut,
      columns.breakMinutes,
      columns.workedMinutes,
      columns.overtimeMinutes,
      columns.nightMinutes,
      columns.minutesLate,
      columns.status,
      columns.estimatedPay,
      columns.corrections,
    ],
    ...monthShifts.map((shift) => {
      const summary = summaries.find((candidate) => candidate.shiftId === shift.id);
      const job = jobs.find((candidate) => candidate.id === shift.jobPostingId) ?? allJobs.find((candidate) => candidate.id === shift.jobPostingId);
      return [
        dateKey(shift.scheduledStartAt),
        workerName(shift.applicationId),
        job?.title ?? m.attendance.fallbackJob,
        formatTime(shift.scheduledStartAt),
        formatTime(shift.scheduledEndAt),
        summary?.actualCheckInAt ? formatTime(summary.actualCheckInAt) : "",
        summary?.actualCheckOutAt ? formatTime(summary.actualCheckOutAt) : "",
        summary?.breakMinutes ?? 0,
        summary?.workedMinutes ?? 0,
        summary?.overtimeMinutes ?? 0,
        summary?.nightMinutes ?? 0,
        summary?.minutesLate ?? 0,
        m.labels.shiftStatus[shift.status],
        summary?.estimatedPay ?? 0,
        summary?.correctionCount ?? 0,
      ];
    }),
  ];
  return csvResponse(rows, `attendance_${month}.csv`, fill(m.attendance.export.filename, { month }));
}
