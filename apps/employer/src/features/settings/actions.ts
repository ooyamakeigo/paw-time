"use server";

import type { Store, StoreSettings, UpdateStoreInput } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { putBusiness } from "@/lib/api";
import { errorMessage } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";

const ROUNDING = [1, 5, 10, 15, 30] as const;

export async function updateSettingsAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const storeId = encodeURIComponent(String(formData.get("storeId") ?? ""));
  const percent = (name: string) => Number(formData.get(name));
  const overtime = percent("overtimePremiumRate");
  const night = percent("nightPremiumRate");
  if (![overtime, night].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
    return { status: "error", message: m.settings.errors.rate };
  }
  const overs = formData.getAll("breakOver").map(Number);
  const requireds = formData.getAll("breakRequired").map(Number);
  const breakRules = overs
    .map((over, index) => ({ workedOverMinutes: over, requiredBreakMinutes: requireds[index] ?? 0 }))
    .filter((rule) => rule.workedOverMinutes > 0 || rule.requiredBreakMinutes > 0);
  if (breakRules.some((rule) => !Number.isInteger(rule.workedOverMinutes) || !Number.isInteger(rule.requiredBreakMinutes) || rule.workedOverMinutes < 0 || rule.requiredBreakMinutes < 0)) {
    return { status: "error", message: m.settings.errors.breakRule };
  }
  const rounding = Number(formData.get("roundingMinutes"));
  const closingDay = Number(formData.get("closingDay"));
  const result = await putBusiness<StoreSettings>(`/stores/${storeId}/settings`, {
    breakRules,
    overtimePremiumRate: Math.round(overtime) / 100,
    nightPremiumRate: Math.round(night) / 100,
    roundingMinutes: ROUNDING.includes(rounding as (typeof ROUNDING)[number]) ? rounding : 1,
    closingDay: Number.isInteger(closingDay) && closingDay >= 0 && closingDay <= 28 ? closingDay : 0,
  });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: m.settings.toast };
}

const LOGO_TYPES = new Set(["image/png", "image/svg+xml", "image/jpeg", "image/webp"]);
const LOGO_MAX_BYTES = 200 * 1024;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** The island's looks. A logo file becomes a data URL so the demo needs no file storage. */
export async function updateStoreLookAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const storeId = encodeURIComponent(String(formData.get("storeId") ?? ""));
  const signColor = String(formData.get("signColor") ?? "");
  const accentColor = String(formData.get("accentColor") ?? "");
  const values = String(formData.get("values") ?? "").trim().slice(0, 80);
  if (!HEX_COLOR.test(signColor) || !HEX_COLOR.test(accentColor)) {
    return { status: "error", message: m.shopIsland.look.errors.color };
  }
  const input: UpdateStoreInput = { signColor, accentColor, values };
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!LOGO_TYPES.has(logo.type) || logo.size > LOGO_MAX_BYTES) {
      return { status: "error", message: m.shopIsland.look.errors.logo };
    }
    const bytes = Buffer.from(await logo.arrayBuffer());
    input.logoUrl = `data:${logo.type};base64,${bytes.toString("base64")}`;
  } else if (formData.get("removeLogo") === "on") {
    input.logoUrl = null;
  }
  const result = await putBusiness<Store>(`/stores/${storeId}`, input);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: m.shopIsland.look.toast };
}
