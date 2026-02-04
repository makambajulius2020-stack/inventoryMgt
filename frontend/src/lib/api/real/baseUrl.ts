export function getBaseUrl() {
  const env = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (env && env.trim()) return env.trim().replace(/\/+$/, "");
  return "http://127.0.0.1:8000";
}
