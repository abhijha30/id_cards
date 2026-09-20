"use client";

import { useId, useRef } from "react";
import { SubmitButton } from "@/components/ui/SubmitButton";

type Props = {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  /** Server action run when the person confirms. */
  action: (formData: FormData) => Promise<void>;
  /** Hidden fields sent with the action (ids, return path). */
  fields: Record<string, string>;
  triggerClassName?: string;
};

/** A button that opens a native modal <dialog> (focus trap and Escape handled by the browser). */
export function ConfirmAction({ triggerLabel, title, description, confirmLabel, action, fields, triggerClassName = "btn btn-danger btn-sm" }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => dialogRef.current?.showModal()}>
        {triggerLabel}
      </button>
      <dialog ref={dialogRef} className="dialog" aria-labelledby={titleId} aria-describedby={descId}>
        <form action={action}>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <h2 id={titleId} className="text-xl font-semibold">
            {title}
          </h2>
          <p id={descId} className="mt-2 text-mist">
            {description}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <SubmitButton className="btn btn-danger" pendingLabel="Working...">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
