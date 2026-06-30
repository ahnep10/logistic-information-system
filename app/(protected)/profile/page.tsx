import { auth } from "@/lib/auth"
import ChangePasswordForm from "./change-password-form"

export default async function ProfilePage() {
  const session = await auth()

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Profile</h1>
      <ChangePasswordForm
        currentUserName={session?.user?.name ?? ""}
        currentUserEmail={session?.user?.email ?? ""}
      />
    </div>
  )
}
