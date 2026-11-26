// Vercel function at /api/errors (and /aqm/api/errors through vercel.json): error reports from the
// browser, stored in Supabase and diagnosed by Claude. See _errors.ts.
import { handleErrors } from "./_errors.js"; // compiled from _errors.ts by Vercel

const env = () => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export function POST(request: Request): Promise<Response> {
  return handleErrors(request, env());
}
