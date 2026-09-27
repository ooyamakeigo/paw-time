"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useMessages } from "@/lib/i18n/client";

export type SearchIndex = {
  workers: Array<{ id: string; name: string }>;
  jobs: Array<{ id: string; title: string; status: string }>;
  pages: Array<{ href: string; label: string }>;
};

const LIMIT = 5;

/** Finds workers, jobs and pages from anywhere; results are links, so it works without a script too. */
export function GlobalSearch({ index }: { index: SearchIndex }) {
  const m = useMessages();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = (text: string) => needle.length > 0 && text.toLowerCase().includes(needle);
  const workers = index.workers.filter((worker) => matches(worker.name)).slice(0, LIMIT);
  const jobs = index.jobs.filter((job) => matches(job.title)).slice(0, LIMIT);
  const pages = index.pages.filter((page) => matches(page.label)).slice(0, LIMIT);
  const total = workers.length + jobs.length + pages.length;

  return (
    <div className="search" ref={root}>
      <form action="/workers" method="get" onSubmit={(event) => event.preventDefault()} role="search">
        <input
          aria-controls={listId}
          aria-expanded={open && needle.length > 0}
          aria-label={m.app.search}
          autoComplete="off"
          name="q"
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
          placeholder={m.app.searchPlaceholder}
          type="search"
          value={query}
        />
      </form>
      {open && needle.length > 0 ? (
        <div className="searchResults" id={listId}>
          {total === 0 ? <p className="searchEmpty">{m.app.searchEmpty}</p> : null}
          {workers.length > 0 ? (
            <section>
              <p className="searchGroup">{m.app.searchWorkers}</p>
              {workers.map((worker) => (
                <Link href={`/workers#worker-${worker.id}`} key={worker.id} onClick={() => setOpen(false)}>{worker.name}</Link>
              ))}
            </section>
          ) : null}
          {jobs.length > 0 ? (
            <section>
              <p className="searchGroup">{m.app.searchJobs}</p>
              {jobs.map((job) => (
                <Link href={`/jobs#job-${job.id}`} key={job.id} onClick={() => setOpen(false)}>
                  {job.title}<small>{job.status}</small>
                </Link>
              ))}
            </section>
          ) : null}
          {pages.length > 0 ? (
            <section>
              <p className="searchGroup">{m.app.searchPages}</p>
              {pages.map((page) => (
                <Link href={page.href} key={page.href} onClick={() => setOpen(false)}>{page.label}</Link>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
