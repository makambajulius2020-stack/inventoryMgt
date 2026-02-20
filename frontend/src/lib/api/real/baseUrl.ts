import { requireEnv } from "@/lib/runtime/env";

export function getBaseUrl() {
  const env = requireEnv("NEXT_PUBLIC_API_BASE_URL");
  return env.trim().replace(/\/+$/, "");
}
