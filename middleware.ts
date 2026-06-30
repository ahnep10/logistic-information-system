// middleware.ts — AT PROJECT ROOT (not in /app)
// Imports from "./auth.config" (Edge-safe) — NOT from "./lib/auth" (Node.js only)
// Importing lib/auth.ts in middleware would crash Edge runtime with bcryptjs crypto error
import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

const MANAGER_ROUTES = ["/dashboard", "/reports", "/users"]

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth
  const pathname = nextUrl.pathname

  // Case 1: No session and not on /login → redirect to /login
  if (!session) {
    if (pathname === "/login") return NextResponse.next()
    return NextResponse.redirect(new URL("/login", nextUrl))
  }

  // Case 1.5: Authenticated user at root → redirect to role home
  if (pathname === "/") {
    const home = session.user?.role === "MANAGER" ? "/dashboard" : "/inventory"
    return NextResponse.redirect(new URL(home, nextUrl))
  }

  // Case 2: Has session and on /login → redirect to role home (D-12)
  if (pathname === "/login") {
    const home = session.user?.role === "MANAGER" ? "/dashboard" : "/inventory"
    return NextResponse.redirect(new URL(home, nextUrl))
  }

  // Case 3: Has session, route is manager-only, role is not MANAGER → silent redirect to /inventory (D-08, D-09)
  const isManagerRoute = MANAGER_ROUTES.some((route) =>
    pathname.startsWith(route)
  )
  if (isManagerRoute && session.user?.role !== "MANAGER") {
    return NextResponse.redirect(new URL("/inventory", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
