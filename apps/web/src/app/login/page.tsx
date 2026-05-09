import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LoginForm } from "@/components/auth/LoginForm"
import { Music2 } from "lucide-react"

export default async function LoginPage() {
  const session = await auth()

  if (session?.user?.id && session.user.role) {
    redirect("/app/songs")
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(ellipse at 60% 0%, rgba(73,75,214,0.35) 0%, transparent 60%), radial-gradient(ellipse at 10% 80%, rgba(68,226,205,0.15) 0%, transparent 50%), var(--color-bg)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, #494bd6 0%, #8083ff 100%)",
              boxShadow: "0 8px 32px rgba(73,75,214,0.4)",
            }}
          >
            <Music2 size={28} color="white" strokeWidth={2} />
          </div>

          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ color: "var(--color-on-surface)" }}
          >
            WorshipFlow
          </h1>

          <p
            className="text-sm mt-1"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            Espace chantres
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}