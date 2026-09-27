import type { MemberRole } from "@paw-time/api-contracts";
import type { Messages } from "./i18n/messages";

export type NavItem = { href: string; key: keyof Messages["nav"]; managerOnly?: boolean };
export type NavGroup = { key: "groupDaily" | "groupHiring" | "groupReview" | "groupAdmin"; items: NavItem[] };

/** The sidebar, the mobile tab bar and the search box all read this. */
export const navGroups: NavGroup[] = [
  {
    key: "groupDaily",
    items: [
      { href: "/", key: "home" },
      { href: "/calendar", key: "calendar" },
      { href: "/attendance", key: "attendance" },
      { href: "/kiosk", key: "kiosk" },
    ],
  },
  {
    key: "groupHiring",
    items: [
      { href: "/jobs", key: "jobs" },
      { href: "/applications", key: "applications" },
      { href: "/workers", key: "workers" },
    ],
  },
  {
    key: "groupReview",
    items: [
      { href: "/evaluations", key: "reviews" },
      { href: "/payroll", key: "payroll", managerOnly: true },
      { href: "/insights", key: "insights", managerOnly: true },
      { href: "/island", key: "island" },
    ],
  },
  {
    key: "groupAdmin",
    items: [
      { href: "/settings", key: "settings", managerOnly: true },
      { href: "/audit", key: "audit", managerOnly: true },
    ],
  },
];

/** The five destinations that fit a thumb on a phone; the rest open from "more". */
export const primaryTabs: NavItem[] = [
  { href: "/", key: "home" },
  { href: "/attendance", key: "attendance" },
  { href: "/applications", key: "applications" },
  { href: "/jobs", key: "jobs" },
];

export function visibleGroups(role: MemberRole): NavGroup[] {
  return navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => role === "manager" || !item.managerOnly) }))
    .filter((group) => group.items.length > 0);
}

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
