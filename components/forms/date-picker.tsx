"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormField } from "@/components/forms/form-state";
import { cn } from "@/lib/utils";

// Dates are calendar days, not instants: build them at local midnight and
// format the parts directly so no timezone shift can change the day.
function fromIso(value: string | undefined): Date | undefined {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// A local Date as "YYYY-MM-DD", without time zone shifts.
function toIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const displayFormat = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "long", year: "numeric" });

export interface DatePickerProps {
  id: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  /** Earliest selectable day (inclusive), ISO yyyy-mm-dd. */
  min?: string;
  /** Latest selectable day (inclusive), ISO yyyy-mm-dd. */
  max?: string;
  /** Opens on this month when nothing is selected yet, ISO yyyy-mm-dd. */
  initialMonth?: string;
  className?: string;
}

/**
 * Click-to-pick date field. Month and year dropdowns make distant dates such
 * as a birth date quick to reach. Submits ISO yyyy-mm-dd under `name`.
 */
export function DatePicker(props: DatePickerProps) {
  const field = useFormField(props.name, props.defaultValue ?? undefined);
  return <DatePickerField key={field.submission} {...props} field={field} />;
}

// The picker itself. Remounted after each failed submit (see DatePicker).
function DatePickerField({
  id,
  name,
  required,
  placeholder = "Select a date",
  min,
  max,
  initialMonth,
  className,
  field,
}: DatePickerProps & { field: ReturnType<typeof useFormField> }) {
  const [selected, setSelected] = useState<Date | undefined>(() => fromIso(field.defaultValue));
  const [open, setOpen] = useState(false);
  const earliest = fromIso(min);
  const latest = fromIso(max);
  const disabled = [
    ...(earliest ? [{ before: earliest }] : []),
    ...(latest ? [{ after: latest }] : []),
  ];

  return (
    <div className={className}>
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              data-field={name}
              // A button can't carry aria-invalid; the error is announced through aria-describedby.
              data-invalid={field.invalid || undefined}
              aria-describedby={field.errorId}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 border-b-2 bg-transparent px-1 text-left text-base md:text-sm",
                "border-[hsl(var(--cfa-purple)/0.65)] focus-visible:border-[hsl(var(--cfa-purple))] focus-visible:shadow-[0_2px_0_0_hsl(var(--cfa-purple))] focus-visible:outline-none",
                "dark:border-white/50 dark:focus-visible:border-white",
                "data-[invalid=true]:border-destructive data-[invalid=true]:bg-destructive/5 dark:data-[invalid=true]:border-red-400 dark:data-[invalid=true]:bg-red-400/10",
                !selected && "text-muted-foreground",
              )}
            >
              <span>{selected ? displayFormat.format(selected) : placeholder}</span>
              <CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 opacity-70" />
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              captionLayout="dropdown"
              selected={selected}
              defaultMonth={selected ?? fromIso(initialMonth) ?? latest}
              startMonth={earliest}
              endMonth={latest}
              disabled={disabled}
              onSelect={(date) => {
                setSelected(date);
                if (date) setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        {selected && !required && (
          <button
            type="button"
            aria-label="Clear date"
            onClick={() => setSelected(undefined)}
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input type="hidden" name={name} value={selected ? toIso(selected) : ""} />
      {field.error && (
        <p id={field.errorId} className="mt-1 text-sm text-destructive">
          {field.error}
        </p>
      )}
    </div>
  );
}

// Today in Cape Town as "YYYY-MM-DD" (the en-CA locale formats that way).
function todayInCapeTown(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

/** Date of birth: 1900 to today, opening around 2000 so the year dropdown is close. Matches the server rules. */
export function BirthDatePicker(props: Omit<DatePickerProps, "min" | "max" | "initialMonth">) {
  return <DatePicker {...props} min="1900-01-01" max={todayInCapeTown()} initialMonth="2000-01-01" placeholder={props.placeholder ?? "Select your date of birth"} />;
}
