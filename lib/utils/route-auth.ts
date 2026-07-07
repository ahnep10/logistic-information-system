// Route-Handler-appropriate auth gate — source: 06-RESEARCH.md Pitfall 2:
// middleware.ts excludes /api/* from its matcher, so every /api/reports/*
// Route Handler must self-enforce auth; this is NOT inherited from the
// page-level MANAGER_ROUTES guard.
//
// This is the HTTP-Response-returning sibling of actions/products.ts's
// requireManager() (which returns { error: string } for Server Action
// callers, not a Response).
import { auth } from "@/lib/auth"

export async function requireManagerResponse(): Promise<Response | null> {
  const session = await auth()
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }
  if (session.user.role !== "MANAGER") {
    return new Response("Forbidden", { status: 403 })
  }
  return null
}
