"use client";

import { LETTER_BODY_MAX_LENGTH, LETTER_TEMPLATES, type LetterTemplateCode } from "@paw-time/api-contracts/letters";
import { useState } from "react";
import { ActionMessage, SubmitButton, useFormAction } from "@/components/ActionForm";
import { useLocale, useMessages } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/messages";
import { evaluationTagCodes, evaluationTagLabel } from "@/lib/labels";
import { submitReviewAction } from "./actions";

type ReviewFormProps = {
  shiftId: string;
  workerId: string;
  evaluationExperience: number;
  letterExperience: number;
};

type LetterChoice = LetterTemplateCode | "custom" | "none";

/** Rating, tags and comment for the record, plus a letter the obake carries to the worker. */
export function ReviewForm({ shiftId, workerId, evaluationExperience, letterExperience }: ReviewFormProps) {
  const m = useMessages();
  const locale = useLocale();
  const [state, formAction] = useFormAction(submitReviewAction);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [letter, setLetter] = useState<LetterChoice>("thank_you");
  const [letterBody, setLetterBody] = useState("");
  const preset = LETTER_TEMPLATES.find((candidate) => candidate.code === letter);
  const totalExperience = evaluationExperience + (letter === "none" ? 0 : letterExperience);

  const toggleTag = (code: string) =>
    setTags((current) => (current.includes(code) ? current.filter((tag) => tag !== code) : [...current, code]));

  return (
    <form action={formAction} className="evaluationForm">
      <input name="shiftId" type="hidden" value={shiftId} />
      <input name="workerId" type="hidden" value={workerId} />
      <fieldset className="starRating">
        <legend>{m.reviews.rating}</legend>
        {[5, 4, 3, 2, 1].map((value) => (
          <label key={value} title={fill(m.reviews.stars, { count: value })}>
            <input
              checked={rating === value}
              name="rating"
              onChange={() => setRating(value)}
              required
              type="radio"
              value={value}
            />
            <span aria-hidden="true">★</span>
            <span className="visuallyHidden">{fill(m.reviews.stars, { count: value })}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="tagChips">
        <legend>{m.reviews.tags}</legend>
        {evaluationTagCodes.map((code) => (
          <label key={code}>
            <input checked={tags.includes(code)} name="tags" onChange={() => toggleTag(code)} type="checkbox" value={code} />
            <span>{evaluationTagLabel(code, m)}</span>
          </label>
        ))}
      </fieldset>
      <label className="field">
        <span>{m.reviews.comment}</span>
        <textarea
          maxLength={2000}
          name="comment"
          onChange={(event) => setComment(event.target.value)}
          placeholder={m.reviews.commentPlaceholder}
          rows={3}
          value={comment}
        />
      </label>
      <fieldset className="tagChips">
        <legend>{m.reviews.letter}</legend>
        {LETTER_TEMPLATES.map((candidate) => (
          <label key={candidate.code}>
            <input
              checked={letter === candidate.code}
              name="letter"
              onChange={() => setLetter(candidate.code)}
              type="radio"
              value={candidate.code}
            />
            <span>{candidate[locale]}</span>
          </label>
        ))}
        <label>
          <input checked={letter === "custom"} name="letter" onChange={() => setLetter("custom")} type="radio" value="custom" />
          <span>{m.reviews.letterCustom}</span>
        </label>
        <label>
          <input checked={letter === "none"} name="letter" onChange={() => setLetter("none")} type="radio" value="none" />
          <span>{m.reviews.letterNone}</span>
        </label>
      </fieldset>
      {preset ? (
        <p className="letterPreview">
          <img alt="" height={40} src="/obake/hatsukoe.webp" width={40} />
          <span>{fill(m.reviews.letterPreview, { body: preset[locale] })}</span>
        </p>
      ) : null}
      {letter === "custom" ? (
        <label className="field">
          <span className="visuallyHidden">{m.reviews.letter}</span>
          <textarea
            autoFocus
            maxLength={LETTER_BODY_MAX_LENGTH}
            name="letterBody"
            onChange={(event) => setLetterBody(event.target.value)}
            placeholder={m.reviews.letterPlaceholder}
            required
            rows={3}
            value={letterBody}
          />
          <small className="counter">{fill(m.reviews.counter, { count: letterBody.length, max: LETTER_BODY_MAX_LENGTH })}</small>
        </label>
      ) : null}
      <div className="formActions">
        <SubmitButton pendingLabel={m.common.sending}>
          {fill(letter === "none" ? m.reviews.submitReviewOnly : m.reviews.submit, { xp: totalExperience })}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
