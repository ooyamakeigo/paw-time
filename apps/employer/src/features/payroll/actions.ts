"use server";

import type { ClosedPeriod } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { deleteBusiness, postBusiness } from "@/lib/api";
import { createFormatters, isMonthKey } from "@/lib/format";
import { errorMessage, fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";

export async function closePeriodAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, m } = await getMessages();
  const storeId = String(formData.get("storeId") ?? "");
  const month = String(formData.get("month") ?? "");
  if (!isMonthKey(month) || !storeId) return { status: "error", message: errorMessage("invalid_request", m) };
  const result = await postBusiness<ClosedPeriod>("/closed-periods", { storeId, month });
  if (!result.ok) {
    return { status: "error", message: result.code === "invalid_time_range" ? m.payroll.closeFuture : errorMessage(result.code, m) };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: fill(m.payroll.toastClosed, { month: createFormatters(locale).formatMonth(month) }) };
}

export async function reopenPeriodAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { locale, m } = await getMessages();
  const periodId = encodeURIComponent(String(formData.get("periodId") ?? ""));
  const result = await deleteBusiness<ClosedPeriod>(`/closed-periods/${periodId}`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: fill(m.payroll.toastReopened, { month: createFormatters(locale).formatMonth(result.data.month) }) };
}
