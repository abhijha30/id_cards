import type { ActionState } from "@/lib/validation/common";

/** Result banner for a form action. Errors use role=alert so screen readers announce them. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        isError ? "border-danger/50 bg-danger/10 text-danger" : "border-ok/50 bg-ok/10 text-ok"
      }`}
    >
      {state.message}
    </p>
  );
}
