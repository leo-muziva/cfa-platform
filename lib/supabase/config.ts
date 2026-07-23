export interface SupabasePublicConfig {
  url: string;
  publishableKey: string;
}

export type SupabaseConfigErrorCode =
  | "missing"
  | "placeholder"
  | "invalid-url";

export class SupabaseConfigError extends Error {
  constructor(
    message: string,
    public readonly code: SupabaseConfigErrorCode,
  ) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

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

export function getSupabasePublicConfig(): SupabasePublicConfig {
  return validateSupabasePublicConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function hasValidSupabasePublicConfig() {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    return false;
  }
}
