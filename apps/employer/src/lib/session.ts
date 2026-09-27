import { cookies } from "next/headers";

/**
 * Development session, kept in cookies until real sign-in exists:
 * who is acting (a member id), which store the screens are scoped to, and
 * the theme. The API decides the role from the member id.
 */
export const ACTOR_COOKIE = "paw_time_actor";
export const STORE_COOKIE = "paw_time_store";
export const THEME_COOKIE = "paw_time_theme";
export const ONBOARDING_COOKIE = "paw_time_onboarding";

export type Theme = "auto" | "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "auto" || value === "light" || value === "dark";
}

export type Session = {
  actorId: string;
  /** null means every store of the organization. */
  storeId: string | null;
  theme: Theme;
  onboardingDismissed: boolean;
};

export async function getSession(): Promise<Session> {
  const jar = await cookies();
  const theme = jar.get(THEME_COOKIE)?.value;
  const storeId = jar.get(STORE_COOKIE)?.value;
  return {
    actorId: jar.get(ACTOR_COOKIE)?.value || (process.env.PAW_TIME_ACTOR_ID ?? "member-demo"),
    storeId: storeId && storeId !== "all" ? storeId : null,
    theme: isTheme(theme) ? theme : "auto",
    onboardingDismissed: jar.get(ONBOARDING_COOKIE)?.value === "1",
  };
}
