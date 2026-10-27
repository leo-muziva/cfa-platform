"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { ChevronDown } from "lucide-react";
import { useFormField } from "@/components/forms/form-state";
import { cn } from "@/lib/utils";

const DEFAULT_COUNTRY: CountryCode = "ZA";

interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
}

// Every country with its English name and dialling code, for the dropdown.
function countryOptions(): CountryOption[] {
  const names = new Intl.DisplayNames(["en-ZA"], { type: "region" });
  const options = getCountries().map((code) => ({
    code,
    name: names.of(code) ?? code,
    dialCode: getCountryCallingCode(code),
  }));
  options.sort((a, b) => a.name.localeCompare(b.name, "en-ZA"));
  // South Africa first: almost every CFA member uses a local number.
  const home = options.findIndex((option) => option.code === DEFAULT_COUNTRY);
  if (home > 0) options.unshift(...options.splice(home, 1));
  return options;
}

// useSyncExternalStore needs a subscribe function; this store never changes.
const subscribeNothing = () => () => {};

/** True only in the browser, without a hydration mismatch. */
function useIsClient() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

// Splits a stored E.164 number into its country and the national number to show.
function initialState(value: string | undefined): { country: CountryCode; national: string } {
  if (!value) return { country: DEFAULT_COUNTRY, national: "" };
  const parsed = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  if (!parsed) return { country: DEFAULT_COUNTRY, national: value };
  return { country: parsed.country ?? DEFAULT_COUNTRY, national: parsed.formatNational() };
}

/** The value the server receives: E.164 when it parses, otherwise what was typed so the server can say why. */
function submittedValue(country: CountryCode, national: string): string {
  if (!national.trim()) return "";
  const parsed = parsePhoneNumberFromString(national, country);
  return parsed?.number ?? national.trim();
}

export interface PhoneInputProps {
  id: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Country code picker plus a number field that formats as you type. Submits
 * one E.164 value under `name`; the server checks it is valid for the country.
 */
export function PhoneInput(props: PhoneInputProps) {
  const field = useFormField(props.name, props.defaultValue ?? undefined);
  // Remount after each failed submit so the field picks up the restored or cleared value.
  return <PhoneInputFields key={field.submission} {...props} field={field} />;
}

// The country dropdown and number box. Remounted after each failed submit.
function PhoneInputFields({
  id,
  name,
  required,
  placeholder,
  className,
  field,
}: PhoneInputProps & { field: ReturnType<typeof useFormField> }) {
  // Country names come from Intl, which differs between Node and browsers, so
  // the full list is built in the browser only.
  const isClient = useIsClient();
  const options = useMemo(() => (isClient ? countryOptions() : null), [isClient]);
  const [{ country, national }, setPhone] = useState(() => initialState(field.defaultValue));
  const dialCode = getCountryCallingCode(country);

  function changeNumber(text: string) {
    // A pasted international number switches the country to match.
    if (text.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(text);
      if (parsed?.country) {
        setPhone({ country: parsed.country, national: parsed.formatNational() });
        return;
      }
    }
    setPhone({ country, national: new AsYouType(country).input(text) });
  }

  return (
    <div className={className}>
      <div className="flex items-end gap-2">
        <div className="relative shrink-0">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-9 items-center gap-1 border-b-2 px-1 text-sm tabular-nums",
              "border-[hsl(var(--cfa-purple)/0.65)] dark:border-white/50",
              field.invalid && "border-destructive dark:border-red-400",
            )}
          >
            <span className="font-medium">{country}</span>
            <span>+{dialCode}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </span>
          {/* The real control sits invisibly over the chip so it keeps native keyboard type-ahead. */}
          <select
            aria-label="Country code"
            value={country}
            onChange={(event) => {
              const next = event.target.value as CountryCode;
              setPhone({ country: next, national: new AsYouType(next).input(national.replace(/\D/g, "")) });
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {options ? (
              options.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name} (+{option.dialCode})
                </option>
              ))
            ) : (
              <option value={country}>{country} (+{dialCode})</option>
            )}
          </select>
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          data-field={name}
          required={required}
          placeholder={placeholder ?? (country === "ZA" ? "082 123 4567" : undefined)}
          value={national}
          onChange={(event) => changeNumber(event.target.value)}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.errorId}
          className="flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
        />
      </div>
      <input type="hidden" name={name} value={submittedValue(country, national)} />
      {field.error && (
        <p id={field.errorId} className="mt-1 text-sm text-destructive">
          {field.error}
        </p>
      )}
    </div>
  );
}
