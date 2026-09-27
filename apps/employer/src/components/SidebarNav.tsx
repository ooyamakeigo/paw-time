"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMessages } from "@/lib/i18n/client";
import { isActivePath, type NavGroup } from "@/lib/nav";

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const m = useMessages();
  return (
    <nav className="sideNav">
      {groups.map((group) => (
        <div className="navGroup" key={group.key}>
          <p className="navGroupLabel">{m.nav[group.key]}</p>
          {group.items.map((item) => (
            <Link
              aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
              className={item.href === "/kiosk" ? "navKiosk" : undefined}
              href={item.href}
              key={item.href}
            >
              {m.nav[item.key]}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
