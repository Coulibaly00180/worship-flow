import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SideNav, MobileNav } from "@/components/layout/SideNav"

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
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <SideNav user={user} />
      <MobileNav user={user} />

      <main className="min-h-screen lg:ml-[var(--sidebar-width)]">
        {children}
      </main>
    </div>
  )
}