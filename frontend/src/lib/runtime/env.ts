import { EnvironmentError } from "./errors";

export type AppEnv = {
  NEXT_PUBLIC_API_BASE_URL: string;
};

function readRaw(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

export function requireEnv(name: keyof AppEnv): string {
  const value = readRaw(name);
  if (!value) {
    throw new EnvironmentError(`[Env] Missing required environment variable: ${name}`, {
      metadata: { name },
    });
  }
  return value;
}

export function getAppEnv(): AppEnv {
  const NEXT_PUBLIC_API_BASE_URL = requireEnv("NEXT_PUBLIC_API_BASE_URL");
  return { NEXT_PUBLIC_API_BASE_URL };
}
