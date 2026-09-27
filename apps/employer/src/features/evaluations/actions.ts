"use server";

import { LETTER_BODY_MAX_LENGTH, LetterTemplateSchema, type Evaluation, type Letter } from "@paw-time/api-contracts";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { postBusiness } from "@/lib/api";
import { errorMessage, fill } from "@/lib/i18n/messages";
import { getMessages } from "@/lib/i18n/server";
import { rewardExperience } from "@/lib/island";

/** Sends the evaluation, then the letter the employer chose to attach. */
export async function submitReviewAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { m } = await getMessages();
  const shiftId = String(formData.get("shiftId") ?? "");
  const workerId = String(formData.get("workerId") ?? "");
  const rating = Number(formData.get("rating"));
  const tags = formData.getAll("tags").map(String).slice(0, 10);
  const comment = String(formData.get("comment") ?? "").trim();
  const letterChoice = String(formData.get("letter") ?? "none");
  const letterBody = String(formData.get("letterBody") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: "error", message: m.reviews.errorRating };
  }
  if (comment.length > 2000) return { status: "error", message: m.reviews.errorCommentLength };
  const template = letterChoice === "none" ? null : LetterTemplateSchema.safeParse(letterChoice);
  if (template && !template.success) return { status: "error", message: errorMessage("invalid_request", m) };
  if (template?.success && template.data === "custom" && !letterBody) {
    return { status: "error", message: m.reviews.errorLetterEmpty };
  }
  if (letterBody.length > LETTER_BODY_MAX_LENGTH) {
    return { status: "error", message: fill(m.reviews.errorLetterLength, { max: LETTER_BODY_MAX_LENGTH }) };
  }

  const evaluation = await postBusiness<Evaluation>("/evaluations", {
    shiftId,
    subjectType: "worker",
    subjectId: workerId,
    rating,
    tags,
    ...(comment ? { comment } : {}),
  });
  if (!evaluation.ok) return { status: "error", message: errorMessage(evaluation.code, m) };

  let experience = rewardExperience("evaluation_submitted");
  let message = fill(m.reviews.toastReview, { xp: experience });
  if (template?.success) {
    const letter = await postBusiness<Letter>("/letters", {
      shiftId,
      template: template.data,
      ...(template.data === "custom" ? { body: letterBody } : {}),
    });
    if (letter.ok) {
      experience += rewardExperience("letter_sent");
      message = fill(m.reviews.toastBoth, { xp: experience });
    } else {
      message = fill(m.reviews.toastPartial, { reason: errorMessage(letter.code, m) });
    }
  }

  revalidatePath("/", "layout");
  return { status: "success", message };
}
