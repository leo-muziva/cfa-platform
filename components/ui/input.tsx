"use client";

import * as React from "react";

import { useFormField } from "@/components/forms/form-state";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, name, ...props }, ref) => {
    // Inside a ValidatedForm, a named input highlights itself and shows its
    // own error. Elsewhere this is a plain input.
    const field = useFormField(name);
    const describedBy = [props["aria-describedby"], field.errorId].filter(Boolean).join(" ") || undefined;
    const input = (
      <input
        type={type}
        name={name}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        aria-invalid={field.invalid || props["aria-invalid"] || undefined}
        aria-describedby={describedBy}
      />
    );
    if (!field.error || type === "hidden") return input;
    return (
      <>
        {input}
        <p id={field.errorId} className="mt-1 text-sm text-destructive">
          {field.error}
        </p>
      </>
    );
  },
);
Input.displayName = "Input";

export { Input };
