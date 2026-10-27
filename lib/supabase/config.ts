// Reads and checks the public Supabase settings (URL and publishable key).
// A missing or placeholder value gives a clear setup message instead of a
// confusing network error later.
export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

// Why the configuration was rejected.
export type SupabaseConfigErrorCode =
  | "missing"
  | "placeholder"
  | "invalid-url";

/** Thrown when the public Supabase settings are missing or invalid. */
export class SupabaseConfigError extends Error {
  constructor(
    message: string,
    public readonly code: SupabaseConfigErrorCode,
  ) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

// Text found in template values that were never replaced.
const PLACEHOLDER_MARKERS = [
  "[insert",
  "<paste",
  "replace-with",
  "your-project",
  "example.supabase",
];

function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

/** Checks the URL and key and returns them cleaned, or throws SupabaseConfigError. */
export function validateSupabasePublicConfig(values: {
  url?: string;
  publishableKey?: string;
}): SupabasePublicConfig {
  const url = values.url?.trim();
  const publishableKey = values.publishableKey?.trim();

  if (!url || !publishableKey) {
    throw new SupabaseConfigError(
      "Supabase is not configured. For local development, start Supabase and run npm run dev:local. For a hosted project, set the public Supabase variables described in .env.template.",
      "missing",
    );
  }

  if (isPlaceholder(url) || isPlaceholder(publishableKey)) {
    throw new SupabaseConfigError(
      "Supabase still has placeholder configuration. Run npm run dev:local for local Supabase, or replace the placeholders using your hosted project settings.",
      "placeholder",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new SupabaseConfigError(
      "The configured Supabase URL is invalid. Use npm run dev:local or check the hosted project URL.",
      "invalid-url",
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new SupabaseConfigError(
      "The configured Supabase URL must use http or https.",
      "invalid-url",
    );
  }

  return {
    url: parsedUrl.toString().replace(/\/$/, ""),
    publishableKey,
  };
}

/** Validated settings from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. */
export function getSupabasePublicConfig(): SupabasePublicConfig {
  return validateSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** True when the public Supabase settings are usable. */
export function hasValidSupabasePublicConfig() {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    return false;
  }
}
