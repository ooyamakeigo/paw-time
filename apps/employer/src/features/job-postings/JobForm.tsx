"use client";

import type { JobPosting, Store } from "@paw-time/api-contracts";
import { useActionState } from "react";
import { ActionMessage, SubmitButton } from "@/components/ActionForm";
import { idleActionState } from "@/lib/action-state";
import { useMessages } from "@/lib/i18n/client";
import { fill } from "@/lib/i18n/messages";
import { createJobAction } from "./actions";

type JobFormProps = {
  stores: Store[];
  defaultDate: string;
  publishExperience: number;
  /** A job to copy the fields from; the date is left for the manager to set. */
  from?: { job: JobPosting; startTime: string; endTime: string } | undefined;
};

const REPEAT_OPTIONS = [1, 2, 3, 4, 6, 8];

export function JobForm({ stores, defaultDate, publishExperience, from }: JobFormProps) {
  const m = useMessages();
  const [state, formAction] = useActionState(createJobAction, idleActionState);
  const value = (name: string, fallback: string) => state.fields?.[name] ?? fallback;
  const fields = m.jobForm.fields;

  return (
    <form action={formAction} className="panel jobForm">
      {from ? <p className="notice notice-inline">{fill(m.jobForm.fromNotice, { title: from.job.title })}</p> : null}
      <div className="formGrid">
        <label className="field fieldWide">
          <span>{fields.title}</span>
          <input
            defaultValue={value("title", from?.job.title ?? "")}
            maxLength={120}
            name="title"
            placeholder={fields.titlePlaceholder}
            required
            type="text"
          />
        </label>
        <label className="field">
          <span>{fields.store}</span>
          <select defaultValue={value("storeId", from?.job.storeId ?? stores[0]?.id ?? "")} name="storeId" required>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{fields.role}</span>
          <select defaultValue={value("role", from?.job.role ?? "hall")} name="role">
            {Object.entries(m.labels.role).map(([role, label]) => (
              <option key={role} value={role}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field fieldWide">
          <span>{fields.description}</span>
          <textarea
            defaultValue={value("description", from?.job.description.replace(/\n\n\[shift:[^\]]+\]$/, "") ?? "")}
            maxLength={5000}
            name="description"
            placeholder={fields.descriptionPlaceholder}
            rows={4}
          />
        </label>
        <label className="field">
          <span>{fields.date}</span>
          <input defaultValue={value("date", defaultDate)} name="date" required type="date" />
        </label>
        <div className="fieldPair">
          <label className="field">
            <span>{fields.start}</span>
            <input defaultValue={value("startTime", from?.startTime ?? "10:00")} name="startTime" required step={300} type="time" />
          </label>
          <label className="field">
            <span>{fields.end}</span>
            <input defaultValue={value("endTime", from?.endTime ?? "15:00")} name="endTime" required step={300} type="time" />
          </label>
        </div>
        <label className="field">
          <span>{fields.wage}</span>
          <input defaultValue={value("hourlyWage", String(from?.job.hourlyWage ?? 1200))} min={1} name="hourlyWage" required type="number" />
        </label>
        <label className="field">
          <span>{fields.capacity}</span>
          <input defaultValue={value("capacity", String(from?.job.capacity ?? 1))} max={1000} min={1} name="capacity" required type="number" />
        </label>
        <label className="field">
          <span>{fields.repeat}</span>
          <select defaultValue={value("repeatWeeks", "1")} name="repeatWeeks">
            {REPEAT_OPTIONS.map((weeks) => (
              <option key={weeks} value={weeks}>
                {weeks === 1 ? m.jobForm.repeatOnce : fill(m.jobForm.repeatWeeks, { count: weeks })}
              </option>
            ))}
          </select>
        </label>
        <label className="field checkField">
          <input defaultChecked={from?.job.urgent ?? false} name="urgent" type="checkbox" />
          <span>{fields.urgent}</span>
        </label>
      </div>
      <p className="hint">{m.jobForm.hint}</p>
      <div className="formActions">
        <SubmitButton name="intent" pendingLabel={m.common.saving} value="draft" variant="secondary">
          {m.jobForm.saveDraft}
        </SubmitButton>
        <SubmitButton name="intent" pendingLabel={m.common.publishing} value="publish">
          {fill(m.jobForm.publish, { xp: publishExperience })}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
