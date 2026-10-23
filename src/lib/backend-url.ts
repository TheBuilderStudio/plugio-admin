/**
 * Where the Plugio backend lives. Kept free of database and cookie imports so the login code can use it too.
 */

const isDev = () =>
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENVIRONMENT === "development";

/** @returns the backend origin without a trailing slash, or undefined when it is not configured */
export function resolveBackendUrl(staging: boolean): string | undefined {
  const url = staging
    ? process.env.STAGING_BACKEND_API_URL ||
      (isDev() ? process.env.BACKEND_API_URL || "http://localhost:8080" : "https://staging-api.plugio.app")
    : process.env.BACKEND_API_URL || (isDev() ? "http://localhost:8080" : undefined);
  return url?.replace(/\/+$/, "");
}
