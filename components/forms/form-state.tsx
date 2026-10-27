"use client";

import {
  createContext,
  useActionState,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentProps,
} from "react";
import type { FormFieldState } from "@/types/domain";

/**
 * Field-level validation for Server Action forms.
 *
 * Services return `fieldErrors` keyed by schema field. The client keeps what
 * the user typed (it never round-trips through the server), restores every
 * valid field after React resets the form, and clears only the invalid ones.
 */

type SubmittedValues = Record<string, string[]>;

interface FormContextValue {
  fieldErrors: Record<string, string>;
  /** What was submitted last time, minus invalid fields. Undefined before the first failed submit. */
  values?: SubmittedValues;
  /** Changes on every failed submit so stateful inputs can resync. */
  submission: number;
}

const FormStateContext = createContext<FormContextValue | null>(null);

/** Form field names mix snake_case and camelCase; schemas do too. */
export function normalizeFieldName(name: string): string {
  return name.replace(/[_\-\s[\]]/g, "").toLowerCase();
}

// The error for a field, matching names regardless of snake_case or camelCase.
function errorFor(fieldErrors: Record<string, string> | undefined, name: string): string | undefined {
  if (!fieldErrors) return undefined;
  const target = normalizeFieldName(name);
  for (const [key, message] of Object.entries(fieldErrors)) {
    if (normalizeFieldName(key) === target) return message;
  }
  return undefined;
}

/** The id of a field's error message, for aria-describedby. */
export function fieldErrorId(name: string): string {
  return `field-error-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/** Submitted text values, leaving out every field the server rejected. */
export function keptValues(formData: FormData, fieldErrors: Record<string, string> | undefined): SubmittedValues {
  const values: SubmittedValues = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value !== "string" || errorFor(fieldErrors, name)) continue;
    (values[name] ??= []).push(value);
  }
  return values;
}

/**
 * useActionState that also remembers the submitted values when the action
 * fails, dropping the fields the server said were invalid.
 */
export function useFormAction<S extends FormFieldState>(
  action: (state: S, formData: FormData) => Promise<S>,
  initialState: S,
) {
  const submissionRef = useRef(0);
  return useActionState<S, FormData>(async (previous: S, formData: FormData): Promise<S> => {
    const next = await action(previous, formData);
    if (!next.error) return { ...next, values: undefined };
    submissionRef.current += 1;
    return { ...next, values: keptValues(formData, next.fieldErrors), submission: submissionRef.current };
  }, initialState as Awaited<S>);
}

// Input types whose values are never restored after a failed submit.
const RESTORABLE_SKIP = new Set(["hidden", "submit", "button", "reset", "file", "image"]);

/**
 * A <form> that shows field errors and keeps valid input after a failed
 * submit. React resets uncontrolled forms when an action finishes; the layout
 * effect runs after that reset and puts the valid values back.
 */
export function ValidatedForm({
  state,
  children,
  ...props
}: ComponentProps<"form"> & { state: FormFieldState }) {
  const formRef = useRef<HTMLFormElement>(null);
  const contextValue: FormContextValue = {
    fieldErrors: state.fieldErrors ?? {},
    values: state.values,
    submission: state.submission ?? 0,
  };

  useLayoutEffect(() => {
    const form = formRef.current;
    if (!form || !state.values) return;
    const values = state.values;
    let firstInvalid: HTMLElement | null = null;
    for (const element of Array.from(form.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
      if (!element.name) continue;
      const invalid = Boolean(errorFor(state.fieldErrors, element.name));
      if (invalid) {
        element.setAttribute("aria-invalid", "true");
        firstInvalid ??= element.type === "hidden" ? null : element;
      } else if (element.getAttribute("aria-invalid") === "true") {
        element.removeAttribute("aria-invalid");
      }
      if (element instanceof HTMLInputElement && RESTORABLE_SKIP.has(element.type)) continue;
      const submitted = values[element.name] ?? [];
      if (element instanceof HTMLInputElement && (element.type === "checkbox" || element.type === "radio")) {
        element.checked = !invalid && submitted.includes(element.value || "on");
      } else if (element instanceof HTMLSelectElement && element.multiple) {
        for (const option of Array.from(element.options)) option.selected = !invalid && submitted.includes(option.value);
      } else {
        element.value = invalid ? "" : submitted[0] ?? "";
      }
    }
    // Custom inputs (phone, date) mark their visible control with data-field.
    const firstErrorName = Object.keys(state.fieldErrors ?? {})[0];
    const custom = firstErrorName
      ? form.querySelector<HTMLElement>(`[data-field="${CSS.escape(firstErrorName)}"]`)
      : null;
    (firstInvalid ?? custom)?.focus();
  }, [state]);

  return (
    <FormStateContext.Provider value={contextValue}>
      <form ref={formRef} {...props}>{children}</form>
    </FormStateContext.Provider>
  );
}

// What an input needs to show its error and starting value.
export interface FormFieldInfo {
  error?: string;
  invalid: boolean;
  errorId?: string;
  /** Value to start from: the last submitted value, empty if it was invalid, else the fallback. */
  defaultValue?: string;
  submission: number;
}

/** Error state and starting value for one named field inside a ValidatedForm. */
export function useFormField(name: string | undefined, fallback?: string): FormFieldInfo {
  const context = useContext(FormStateContext);
  if (!context || !name) return { invalid: false, defaultValue: fallback, submission: 0 };
  const error = errorFor(context.fieldErrors, name);
  const defaultValue = error ? "" : context.values ? context.values[name]?.[0] ?? fallback : fallback;
  return { error, invalid: Boolean(error), errorId: error ? fieldErrorId(name) : undefined, defaultValue, submission: context.submission };
}

/** The error message under a field, if the server rejected it. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const { error } = useFormField(name);
  if (!error) return null;
  return (
    <p id={fieldErrorId(name)} className={className ?? "mt-1 text-sm text-destructive"}>
      {error}
    </p>
  );
}
