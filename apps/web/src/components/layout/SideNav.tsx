"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { clearOfflineCaches } from "@/lib/offline"
import {
  Home, Music2, CalendarDays, Users, Heart, LogOut, UserCircle, Plus,
} from "lucide-react"
import { canAccessUserAdmin, canManagePlans } from "@/lib/roles"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

type NavUser = {
  name?: string | null
  email?: string | null
  role?: string
  username?: string
  firstName?: string
  lastName?: string
}

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
}

const ROLE_SUBTITLE: Record<string, string> = {
  ADMIN:               "Administrateur",
  RESPONSABLE_CHANTRE: "Responsable chantre",
  CHANTRE:             "Chantre",
  LECTEUR:             "Lecteur",
}

/** Les 5 destinations principales (barre du bas sur téléphone, menu latéral sur ordinateur). */
const MAIN_NAV: NavItem[] = [
  { href: "/app", label: "Accueil", icon: Home, exact: true },
  { href: "/app/songs", label: "Chants", icon: Music2 },
  { href: "/app/plans", label: "Plans", icon: CalendarDays },
  { href: "/app/favorites", label: "Favoris", icon: Heart },
  { href: "/app/profile", label: "Profil", icon: UserCircle },
]

/** Nom affiché : nom + prénom pour ADMIN/RESPONSABLE, pseudo pour les autres */
function displayName(user: NavUser): string {
  const role = user.role ?? ""
  if (role === "ADMIN" || role === "RESPONSABLE_CHANTRE") {
    return user.name ?? user.email ?? "?"
  }
  return user.username ? `@${user.username}` : (user.name ?? "?")
}

function initialsOf(shown: string): string {
  return shown.startsWith("@")
    ? shown.slice(1, 3).toUpperCase()
    : shown.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
}

function isActive(pathname: string, { href, exact }: NavItem) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")
}

export function Brand({ href = "/app" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Worship Flow — accueil">
      <span className="brand-mark" aria-hidden="true">
        <Music2 size={19} strokeWidth={2.25} />
      </span>
      Worship Flow
    </Link>
  )
}

async function logout() {
  await clearOfflineCaches()
  await signOut({ callbackUrl: "/login" })
}

/** Menu latéral fixe (≥ lg) */
export function SideNav({ user }: { user: NavUser }) {
  const pathname = usePathname()
  const role = user.role ?? ""
  const shown = displayName(user)
  const items: NavItem[] = [
    ...MAIN_NAV.slice(0, 4),
    ...(canAccessUserAdmin(role) ? [{ href: "/app/admin/users", label: "Utilisateurs", icon: Users }] : []),
    MAIN_NAV[4],
  ]

  return (
    <aside className="sidebar hidden lg:flex" aria-label="Navigation principale">
      <div className="sidebar-logo">
        <Brand />
      </div>

      {canManagePlans(role) && (
        <div className="px-3 pb-2">
          <Link href="/app/plans/new" className="btn btn-primary w-full">
            <Plus size={17} strokeWidth={2.5} aria-hidden="true" />
            Nouveau plan
          </Link>
        </div>
      )}

      <nav className="sidebar-nav">
        {items.map((item) => {
          const active = isActive(pathname, item)
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="sidebar-nav-link">
              <Icon size={19} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        <ThemeToggle className="mb-2" />
        <div className="sidebar-user" style={{ margin: "0 0 4px" }}>
          <div className="sidebar-avatar" aria-hidden="true">{initialsOf(shown)}</div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "var(--color-on-surface)" }}>{shown}</p>
            <p className="text-xs truncate" style={{ color: "var(--color-on-surface-variant)" }}>{ROLE_SUBTITLE[role] ?? role}</p>
          </div>
        </div>
        <button type="button" onClick={logout} className="sidebar-nav-link">
          <LogOut size={19} strokeWidth={1.75} aria-hidden="true" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}

/** Barre du haut (< lg) : marque + accès rapide au profil */
export function MobileTopBar({ user }: { user: NavUser }) {
  const shown = displayName(user)
  return (
    <header className="mobile-topbar lg:hidden">
      <Brand />
      <Link href="/app/profile" aria-label={`Mon profil (${shown})`} className="sidebar-avatar" style={{ textDecoration: "none" }}>
        {initialsOf(shown)}
      </Link>
    </header>
  )
}

/** Barre de navigation du bas (< lg) : 5 destinations maximum, icône + texte */
export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bottom-nav lg:hidden" aria-label="Navigation principale">
      {MAIN_NAV.map((item) => {
        const active = isActive(pathname, item)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="bottom-nav-link">
            <span className="pill">
              <Icon size={21} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
            </span>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
