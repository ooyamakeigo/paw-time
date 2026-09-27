import type { AuditLogEntry, Member } from "@paw-time/api-contracts";
import Link from "next/link";
import { createFormatters } from "@/lib/format";
import type { Locale, Messages } from "@/lib/i18n/messages";
import { auditActionLabel, auditEntityLabel } from "@/lib/labels";

const ENTITY_TYPES: Array<AuditLogEntry["entityType"]> = [
  "attendance_event",
  "shift",
  "application",
  "job_posting",
  "invitation",
  "evaluation",
  "letter",
  "store_settings",
  "closed_period",
];
const LIMIT = 200;

type AuditTableProps = {
  entries: AuditLogEntry[];
  members: Member[];
  filter: string | null;
  m: Messages;
  locale: Locale;
};

/** Newest first, filterable by what was touched. Names replace member ids where known. */
export function AuditTable({ entries, members, filter, m, locale }: AuditTableProps) {
  const f = createFormatters(locale);
  const rows = entries
    .filter((entry) => !filter || entry.entityType === filter)
    .sort((left, right) => right.id - left.id)
    .slice(0, LIMIT);
  const who = (actorId: string) => members.find((member) => member.id === actorId)?.displayName ?? actorId;
  return (
    <>
      <nav className="filters" aria-label={m.audit.columns.target}>
        <Link aria-current={!filter ? "page" : undefined} href="/audit">{m.audit.all}</Link>
        {ENTITY_TYPES.map((type) => (
          <Link aria-current={filter === type ? "page" : undefined} href={`/audit?type=${type}`} key={type}>
            {auditEntityLabel(type, m)}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="hint">{m.audit.empty}</p>
      ) : (
        <div className="tableCard">
          <table className="auditTable">
            <thead>
              <tr>
                <th>{m.audit.columns.when}</th>
                <th>{m.audit.columns.who}</th>
                <th>{m.audit.columns.action}</th>
                <th>{m.audit.columns.target}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td>{f.formatDateTime(entry.createdAt)}</td>
                  <td><strong>{who(entry.actorId)}</strong></td>
                  <td>{auditActionLabel(entry.action, m)}</td>
                  <td>
                    {auditEntityLabel(entry.entityType, m)}
                    <span className="mono">{entry.entityId.slice(0, 18)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
