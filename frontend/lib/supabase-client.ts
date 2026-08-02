import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./runtime-config";

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig().configured;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const configuration = getSupabasePublicConfig();
  if (
    !configuration.configured ||
    !configuration.url ||
    !configuration.publishableKey
  )
    return null;
  browserClient ??= createBrowserClient(
    configuration.url,
    configuration.publishableKey,
  );
  return browserClient;
}
