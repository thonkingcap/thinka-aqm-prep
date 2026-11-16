// Vercel function at /api/claude/* (vercel.json rewrites /api/claude/<path> to /api/claude?path=<path>).
// Students with an access code from Daniel reach Claude through here, on Daniel's key, which is read
// from Vercel's environment (OWNER_API_KEY) and never sent to a browser. Valid codes: ACCESS_CODES.
import { handle } from "./_proxy.js"; // compiled from _proxy.ts by Vercel

// Read through globalThis so this file needs no Node type definitions.
const env = () => (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

export function GET(request: Request): Promise<Response> {
  return handle(request, env());
}

export function POST(request: Request): Promise<Response> {
  return handle(request, env());
}
