"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMessages } from "@/lib/i18n/client";
import { isActivePath, primaryTabs, type NavGroup } from "@/lib/nav";

/** A thumb-reachable bar on phones: four main places and a sheet with the rest. */
export function MobileTabBar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const m = useMessages();
  const [open, setOpen] = useState(false);
  const primary = new Set(primaryTabs.map((tab) => tab.href));
  const rest = groups.map((group) => ({ ...group, items: group.items.filter((item) => !primary.has(item.href)) }));
  return (
    <>
      {open ? (
        <div className="sheet" role="dialog" aria-label={m.app.more}>
          <button className="sheetBackdrop" onClick={() => setOpen(false)} type="button" aria-label={m.app.close} />
          <div className="sheetBody">
            {rest.map((group) => (
              <div className="sheetGroup" key={group.key}>
                <p className="navGroupLabel">{m.nav[group.key]}</p>
                {group.items.map((item) => (
                  <Link href={item.href} key={item.href} onClick={() => setOpen(false)}>{m.nav[item.key]}</Link>
                ))}
              </div>
            ))}
            <button className="button button-secondary" onClick={() => setOpen(false)} type="button">{m.app.close}</button>
          </div>
        </div>
      ) : null}
      <nav aria-label={m.app.more} className="tabBar">
        {primaryTabs.map((tab) => (
          <Link aria-current={isActivePath(pathname, tab.href) ? "page" : undefined} href={tab.href} key={tab.href}>
            <span aria-hidden="true" className={`tabIcon tabIcon-${tab.key}`} />
            {m.nav[tab.key]}
          </Link>
        ))}
        <button aria-expanded={open} onClick={() => setOpen((current) => !current)} type="button">
          <span aria-hidden="true" className="tabIcon tabIcon-more" />
          {m.app.more}
        </button>
      </nav>
    </>
  );
}
