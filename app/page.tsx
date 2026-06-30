import { redirect } from "next/navigation"

// Root route — middleware handles auth-based routing.
// This fallback ensures authenticated users at / are never served the scaffold boilerplate.
export default function Home() {
  redirect("/login")
}
