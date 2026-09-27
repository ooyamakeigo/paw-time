import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import { MemoryStore, type StoreSnapshot } from "./memory-store.js";

/**
 * Where the in-memory store is saved between restarts.
 *
 * - `PAW_TIME_DATA_FILE`: a JSON file. Enough for one shop on one machine.
 * - `DATABASE_URL`: a PostgreSQL database. The whole snapshot is kept in the
 *   `api_snapshots` table (migration 0004), so the API survives restarts and
 *   can run on more than one machine. The relational tables from the earlier
 *   migrations describe the target shape; writing to them row by row is the
 *   next step once authentication provides real user ids.
 *
 * With neither set, the API starts from the demo seed every time.
 */
export type PersistenceTarget =
  | { kind: "file"; path: string }
  | { kind: "postgres"; pool: pg.Pool }
  | { kind: "none" };

const SAVE_DELAY_MILLISECONDS = 400;
const SNAPSHOT_ID = "default";

export function persistenceTargetFromEnvironment(env: NodeJS.ProcessEnv = process.env): PersistenceTarget {
  if (env.DATABASE_URL) return { kind: "postgres", pool: new pg.Pool({ connectionString: env.DATABASE_URL, max: 2 }) };
  if (env.PAW_TIME_DATA_FILE) return { kind: "file", path: env.PAW_TIME_DATA_FILE };
  return { kind: "none" };
}

export async function loadSnapshot(target: PersistenceTarget): Promise<StoreSnapshot | undefined> {
  switch (target.kind) {
    case "none":
      return undefined;
    case "file":
      try {
        return parseSnapshot(JSON.parse(await readFile(target.path, "utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    case "postgres": {
      await target.pool.query(
        "create table if not exists api_snapshots (id text primary key, snapshot jsonb not null, saved_at timestamptz not null default now())",
      );
      const result = await target.pool.query<{ snapshot: unknown }>("select snapshot from api_snapshots where id = $1", [SNAPSHOT_ID]);
      const row = result.rows[0];
      return row ? parseSnapshot(row.snapshot) : undefined;
    }
  }
}

export async function saveSnapshot(target: PersistenceTarget, snapshot: StoreSnapshot): Promise<void> {
  switch (target.kind) {
    case "none":
      return;
    case "file": {
      await mkdir(dirname(target.path), { recursive: true });
      const temporary = `${target.path}.tmp`;
      await writeFile(temporary, JSON.stringify(snapshot), "utf8");
      await rename(temporary, target.path);
      return;
    }
    case "postgres":
      await target.pool.query(
        `insert into api_snapshots (id, snapshot, saved_at) values ($1, $2::jsonb, now())
         on conflict (id) do update set snapshot = excluded.snapshot, saved_at = excluded.saved_at`,
        [SNAPSHOT_ID, JSON.stringify(snapshot)],
      );
      return;
  }
}

/** Saves shortly after each change, coalescing bursts; returns a function that flushes and stops. */
export function attachPersistence(
  store: MemoryStore,
  target: PersistenceTarget,
  onError: (error: unknown) => void = (error) => console.error("Could not save the store:", error),
): () => Promise<void> {
  if (target.kind === "none") return async () => undefined;
  let timer: NodeJS.Timeout | null = null;
  let saving: Promise<void> = Promise.resolve();
  const flush = () => {
    timer = null;
    saving = saving.then(() => saveSnapshot(target, store.toSnapshot())).catch(onError);
    return saving;
  };
  store.onChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY_MILLISECONDS);
  });
  return async () => {
    if (timer) {
      clearTimeout(timer);
      await flush();
    } else {
      await saving;
    }
  };
}

function parseSnapshot(value: unknown): StoreSnapshot {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) {
    throw new Error("Unrecognized store snapshot");
  }
  return value as StoreSnapshot;
}
