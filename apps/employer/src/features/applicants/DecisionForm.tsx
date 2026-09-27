"use client";

import { ActionMessage, SubmitButton, useFormAction } from "@/components/ActionForm";
import { useMessages } from "@/lib/i18n/client";
import { decideApplicationAction } from "./actions";

type DecisionFormProps = {
  applicationId: string;
  canSelect: boolean;
};

export function DecisionForm({ applicationId, canSelect }: DecisionFormProps) {
  const m = useMessages();
  const [state, formAction] = useFormAction(decideApplicationAction);
  return (
    <form action={formAction} className="decisionForm">
      <input name="applicationId" type="hidden" value={applicationId} />
      <label className="field">
        <span className="visuallyHidden">{m.applications.noteLabel}</span>
        <input
          defaultValue={state.fields?.note ?? ""}
          maxLength={1000}
          name="note"
          placeholder={m.applications.notePlaceholder}
          type="text"
        />
      </label>
      <div className="formActions">
        {canSelect ? (
          <SubmitButton name="decision" pendingLabel={m.common.recording} value="selected">
            {m.applications.hire}
          </SubmitButton>
        ) : null}
        <SubmitButton name="decision" pendingLabel={m.common.recording} value="rejected" variant="secondary">
          {m.applications.pass}
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
