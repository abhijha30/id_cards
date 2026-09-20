export type FieldErrors = Record<string, string>;

/** Text the person typed, echoed back so the form keeps their input after a failed submit. */
export type FormValues = Record<string, string>;

/**
 * `nonce` is unique per result. Forms use it as a React key so their fields are rebuilt from the
 * latest defaults after every submit (React otherwise resets <select> elements to their first
 * option, which would silently drop a chosen team or consent status).
 */
export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; nonce: string }
  | { status: "error"; message: string; nonce: string; fieldErrors?: FieldErrors; values?: FormValues };

export const IDLE: ActionState = { status: "idle" };

export function errorState(message: string, fieldErrors?: FieldErrors, values?: FormValues): ActionState {
  return { status: "error", message, nonce: crypto.randomUUID(), ...(fieldErrors ? { fieldErrors } : {}), ...(values ? { values } : {}) };
}

export function successState(message: string): ActionState {
  return { status: "success", message, nonce: crypto.randomUUID() };
}

/** React key for a form body: stable until the first submit, then new after every result. */
export function stateKey(state: ActionState): string {
  return state.status === "idle" ? "initial" : state.nonce;
}

/** Every text field of a submitted form (files are skipped). Never includes passwords. */
export function formValues(formData: FormData): FormValues {
  const out: FormValues = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION") && !/password/i.test(key)) out[key] = value;
  }
  return out;
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Reads a string field from FormData ("" when missing or when a File was sent). */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formCheckbox(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

/** First message per field from a zod issue list. Field key = first path segment. */
export function issuesToFieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
