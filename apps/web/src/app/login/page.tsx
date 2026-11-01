import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { LoginForm } from "@/components/auth/LoginForm"
import { Music2 } from "lucide-react"

export const metadata = { title: "Connexion" }

export default async function LoginPage() {
  const session = await auth()

  if (session?.user?.id && session.user.role) {
    redirect("/app")
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-4" style={{ background: "var(--color-bg)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="brand-mark mx-auto mb-4" style={{ width: 64, height: 64, borderRadius: "var(--radius-xl)" }} aria-hidden="true">
            <Music2 size={32} strokeWidth={2} />
          </span>
          <h1 className="text-4xl font-bold" style={{ color: "var(--color-on-surface)" }}>
            Worship Flow
          </h1>
          <p className="mt-2 text-base" style={{ color: "var(--color-on-surface-variant)" }}>
            Les chants et les plans de service de la chorale
          </p>
        </div>

        <LoginForm />

        <p className="text-center text-sm mt-6" style={{ color: "var(--color-on-surface-variant)" }}>
          Pas encore de compte ? Demandez-le à votre responsable chantre.
        </p>
      </div>
    </main>
  )
}
