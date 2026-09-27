"use server";

import type { JobPosting } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { postBusiness } from "@/lib/api";
import { shiftDateKey, toJstTimestamp } from "@/lib/format";
import { errorMessage, fill, type Messages } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";

const jobFields = [
  "storeId",
  "title",
  "role",
  "description",
  "date",
  "startTime",
  "endTime",
  "hourlyWage",
  "capacity",
  "repeatWeeks",
] as const;

type JobFields = Record<(typeof jobFields)[number], string>;

const MAX_REPEAT_WEEKS = 8;

/** Creates the job, and the same slot on the following weeks when asked to repeat. */
export async function createJobAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const fields = Object.fromEntries(
    jobFields.map((name) => [name, String(formData.get(name) ?? "").trim()]),
  ) as JobFields;
  const publish = formData.get("intent") === "publish";
  const urgent = formData.get("urgent") === "on";

  const problem = validateJob(fields, m);
  if (problem) return { status: "error", message: problem, fields };

  const weeks = Number(fields.repeatWeeks || "1");
  const created: JobPosting[] = [];
  for (let week = 0; week < weeks; week += 1) {
    const date = shiftDateKey(fields.date, week * 7);
    // A shift that ends at or before its start time runs past midnight.
    const endDate = fields.endTime <= fields.startTime ? shiftDateKey(date, 1) : date;
    const result = await postBusiness<JobPosting>("/jobs", {
      storeId: fields.storeId,
      title: fields.title,
      role: fields.role,
      description: fields.description,
      hourlyWage: Number(fields.hourlyWage),
      capacity: Number(fields.capacity),
      startsAt: toJstTimestamp(date, fields.startTime),
      endsAt: toJstTimestamp(endDate, fields.endTime),
      status: publish ? "published" : "draft",
      urgent,
    });
    if (!result.ok) {
      if (created.length === 0) return { status: "error", message: errorMessage(result.code, m), fields };
      break;
    }
    created.push(result.data);
  }

  revalidatePath("/", "layout");
  const first = created[0];
  if (!first) return { status: "error", message: errorMessage("unknown", m), fields };
  redirect(created.length > 1 ? `/jobs?created=${encodeURIComponent(first.id)}&count=${created.length}` : `/jobs?created=${encodeURIComponent(first.id)}`);
}

function validateJob(fields: JobFields, m: Messages): string | null {
  const errors = m.jobForm.errors;
  if (!fields.title) return errors.title;
  if (fields.title.length > 120) return errors.titleLength;
  if (!fields.storeId) return errors.store;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) return errors.date;
  if (!/^\d{2}:\d{2}$/.test(fields.startTime) || !/^\d{2}:\d{2}$/.test(fields.endTime)) return errors.times;
  if (fields.startTime === fields.endTime) return errors.sameTime;
  const wage = Number(fields.hourlyWage);
  if (!Number.isInteger(wage) || wage <= 0) return errors.wage;
  const capacity = Number(fields.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) return errors.capacity;
  const weeks = Number(fields.repeatWeeks || "1");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_REPEAT_WEEKS) return errors.repeat;
  return null;
}

export async function publishJobAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const result = await postBusiness<JobPosting>(`/jobs/${idFrom(formData, "jobId")}/publish`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: fill(m.jobs.toastPublished, { xp: rewardExperience("job_published") }) };
}

export async function closeJobAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const result = await postBusiness<JobPosting>(`/jobs/${idFrom(formData, "jobId")}/close`);
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: m.jobs.toastClosed };
}

function idFrom(formData: FormData, name: string): string {
  return encodeURIComponent(String(formData.get(name) ?? ""));
}
