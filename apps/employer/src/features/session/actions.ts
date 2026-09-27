"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { ACTOR_COOKIE, ONBOARDING_COOKIE, STORE_COOKIE, THEME_COOKIE, isTheme } from "../../lib/session";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const options = { path: "/", maxAge: ONE_YEAR_SECONDS, sameSite: "lax" as const };

export async function setActorAction(formData: FormData): Promise<void> {
  const actorId = String(formData.get("actorId") ?? "").trim();
  if (!actorId || actorId.length > 128) return;
  (await cookies()).set(ACTOR_COOKIE, actorId, options);
  revalidatePath("/", "layout");
}

export async function setStoreAction(formData: FormData): Promise<void> {
  const storeId = String(formData.get("storeId") ?? "all").trim();
  if (!storeId || storeId.length > 128) return;
  (await cookies()).set(STORE_COOKIE, storeId, options);
  revalidatePath("/", "layout");
}

export async function setThemeAction(formData: FormData): Promise<void> {
  const theme = formData.get("theme");
  if (!isTheme(theme)) return;
  (await cookies()).set(THEME_COOKIE, theme, options);
  revalidatePath("/", "layout");
}

export async function dismissOnboardingAction(): Promise<void> {
  (await cookies()).set(ONBOARDING_COOKIE, "1", options);
  revalidatePath("/", "layout");
}
