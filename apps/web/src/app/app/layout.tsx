import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SideNav, MobileTopBar, BottomNav } from "@/components/layout/SideNav"
import { AppearanceSync } from "@/components/layout/AppearanceSync"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user?.id || !session.user.role) {
    redirect("/login")
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    role: session.user.role,
    username: session.user.username ?? "",
    firstName: session.user.firstName ?? "",
    lastName: session.user.lastName ?? "",
  }

  return (
    <div className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      <AppearanceSync userId={session.user.id} />
      <a href="#contenu" className="skip-link">Aller au contenu</a>
      <SideNav user={user} />
      <MobileTopBar user={user} />

      <main id="contenu" className="min-h-dvh lg:ml-[var(--sidebar-width)]">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
