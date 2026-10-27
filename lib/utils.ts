import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hasValidSupabasePublicConfig } from "./supabase/config";

/** Joins Tailwind class names, letting later classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** True when the public Supabase settings are configured. */
export const hasEnvVars = hasValidSupabasePublicConfig();
