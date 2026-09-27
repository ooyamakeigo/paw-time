import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { MemoryStore, replaceStore, store } from "./infrastructure/memory-store.js";
import { attachPersistence, loadSnapshot, persistenceTargetFromEnvironment } from "./infrastructure/persistence.js";

const port = Number(process.env.PORT ?? 8787);

const target = persistenceTargetFromEnvironment();
const snapshot = await loadSnapshot(target);
if (snapshot) {
  replaceStore(new MemoryStore({ snapshot }));
  console.log(`Loaded saved data from ${target.kind === "postgres" ? "PostgreSQL" : target.kind === "file" ? target.path : "memory"} (saved ${snapshot.savedAt})`);
} else if (target.kind !== "none") {
  console.log("No saved data yet; starting from the demo seed and saving from here on.");
}
const flush = attachPersistence(store, target);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Paw Time API listening on http://localhost:${info.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void flush().finally(() => process.exit(0));
  });
}
