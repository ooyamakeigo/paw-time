import type { Application, JobPosting, Shift } from "@paw-time/api-contracts";

/** Narrows the organization's records to one store, or leaves them whole. */
export function scopeToStore<
  T extends { jobs: JobPosting[]; shifts?: Shift[]; applications?: Application[] },
>(storeId: string | null, records: T): T {
  if (!storeId) return records;
  const jobs = records.jobs.filter((job) => job.storeId === storeId);
  const jobIds = new Set(jobs.map((job) => job.id));
  return {
    ...records,
    jobs,
    ...(records.shifts ? { shifts: records.shifts.filter((shift) => shift.storeId === storeId) } : {}),
    ...(records.applications
      ? { applications: records.applications.filter((application) => jobIds.has(application.jobPostingId)) }
      : {}),
  };
}
