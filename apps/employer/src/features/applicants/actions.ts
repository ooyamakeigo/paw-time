"use server";

import type { Application, Invitation } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { listApplications, postBusiness } from "@/lib/api";
import { errorMessage, fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";

export async function decideApplicationAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { m } = await getMessages();
  const applicationId = encodeURIComponent(String(formData.get("applicationId") ?? ""));
  const decision = formData.get("decision") === "selected" ? "selected" : "rejected";
  const note = String(formData.get("note") ?? "").trim();
  if (note.length > 1000) {
    return { status: "error", message: m.applications.noteLength, fields: { note } };
  }

  const result = await postBusiness<Application>(`/applications/${applicationId}/decision`, {
    decision,
    ...(note ? { note } : {}),
  });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m), fields: { note } };

  revalidatePath("/", "layout");
  return {
    status: "success",
    message: decision === "selected" ? m.applications.toastHired : m.applications.toastPassed,
  };
}

/** Passes on everyone still waiting for a job whose openings are filled. */
export async function bulkPassAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const jobId = String(formData.get("jobId") ?? "");
  const applications = (await listApplications()) ?? [];
  const waiting = applications.filter((application) => application.jobPostingId === jobId && application.status === "applied");
  let passed = 0;
  let failure: string | null = null;
  for (const application of waiting) {
    const result = await postBusiness<Application>(`/applications/${encodeURIComponent(application.id)}/decision`, {
      decision: "rejected",
      note: m.applications.bulkPassNote,
    });
    if (result.ok) passed += 1;
    else failure = result.code;
  }
  revalidatePath("/", "layout");
  if (passed === 0 && failure) return { status: "error", message: errorMessage(failure, m) };
  return { status: "success", message: fill(m.applications.toastBulkPassed, { count: passed }) };
}

export async function inviteWorkerAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const jobPostingId = String(formData.get("jobId") ?? "");
  const workerId = String(formData.get("workerId") ?? "");
  const result = await postBusiness<Invitation>("/invitations", { jobPostingId, workerId });
  if (!result.ok) return { status: "error", message: errorMessage(result.code, m) };
  revalidatePath("/", "layout");
  return { status: "success", message: fill(m.applications.invite.toast, { name: result.data.workerDisplayName }) };
}
