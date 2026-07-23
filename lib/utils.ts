import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hasValidSupabasePublicConfig } from "./supabase/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const hasEnvVars = hasValidSupabasePublicConfig();
