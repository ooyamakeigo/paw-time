"use server";

import { AttendanceEventKindSchema, type AttendanceEvent } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { postAsWorker } from "@/lib/api";
import { errorMessage, fill, type Messages } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";

function kindLabel(kind: AttendanceEvent["kind"], m: Messages): string {
  switch (kind) {
    case "check_in":
      return m.kiosk.checkIn;
    case "check_out":
      return m.kiosk.checkOut;
    case "break_start":
      return m.kiosk.breakStart;
    case "break_end":
      return m.kiosk.breakEnd;
  }
}

/** A worker punching on the shop's tablet: recorded as the worker, at the current time. */
export async function kioskPunchAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = encodeURIComponent(String(formData.get("shiftId") ?? ""));
  const workerId = String(formData.get("workerId") ?? "");
  const name = String(formData.get("name") ?? "");
  const kind = AttendanceEventKindSchema.safeParse(formData.get("kind"));
  if (!kind.success || !workerId) return { status: "error", message: errorMessage("invalid_request", m) };
  const result = await postAsWorker<AttendanceEvent>(workerId, `/shifts/${shiftId}/attendance`, {
    kind: kind.data,
    recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    clientRequestId: `kiosk-${shiftId}-${kind.data}-${Date.now()}`,
  });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: fill(m.kiosk.toast, { name, kind: kindLabel(kind.data, m) }) };
}
