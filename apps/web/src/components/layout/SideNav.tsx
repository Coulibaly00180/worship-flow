"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  LayoutDashboard, Music2, CalendarDays, Users,
  Heart, LogOut, UserCircle, Plus, X, Menu,
} from "lucide-react"
import { useState, useEffect } from "react"
import { canAccessUserAdmin, canManagePlans } from "@/lib/roles"

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
  RESPONSABLE_CHANTRE: "Responsable Chantre",
  CHANTRE:             "Chantre",
  LECTEUR:             "Lecteur",
}

/** Nom affiché dans la sidebar : nom+prénom pour ADMIN/RESPONSABLE, pseudo pour les autres */
function displayName(user: NavUser): string {
  const role = user.role ?? ""
  if (role === "ADMIN" || role === "RESPONSABLE_CHANTRE") {
    return user.name ?? user.email ?? "?"
  }
  return user.username ? `@${user.username}` : (user.name ?? "?")
}

function NavLink({ href, label, icon: Icon, exact, onClick }: NavItem & { onClick?: () => void }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <Link href={href} aria-current={active ? "page" : undefined} className="sidebar-nav-link" onClick={onClick}>
      <Icon size={16} strokeWidth={active ? 2.5 : 1.75} />
      {label}
    </Link>
  )
}

function NavContent({ user, onClose }: { user: NavUser; role: string; onClose?: () => void }) {
  const role = user.role ?? ""
  const showAdmin = canAccessUserAdmin(role)
  const showNewSetlist = canManagePlans(role)
  const shown = displayName(user)
  const initials = shown.startsWith("@")
    ? shown.slice(1, 3).toUpperCase()
    : shown.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <>
      {/* Logo */}
      <div className="sidebar-logo" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          WorshipFlow
          <span>Church Presenter</span>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: "4px", marginRight: "-4px" }}>
            <X size={18} />
          </button>
        )}
      </div>

      {/* Profil */}
      <div className="sidebar-user">
        <div className="sidebar-avatar">{initials}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
            {shown}
          </p>
          <p className="text-xs truncate" style={{ color: "var(--color-on-surface-variant)" }}>
            {ROLE_SUBTITLE[role] ?? role}
          </p>
        </div>
      </div>

      {/* Bouton New Setlist */}
      {showNewSetlist && (
        <div className="px-3 pt-3 pb-1">
          <Link href="/app/plans/new" className="btn btn-primary w-full btn-sm" style={{ justifyContent: "center" }} onClick={onClose}>
            <Plus size={15} strokeWidth={2.5} />
            New Setlist
          </Link>
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        <NavLink href="/app" label="Tableau de Bord" icon={LayoutDashboard} exact onClick={onClose} />
        <NavLink href="/app/songs" label="Bibliothèque" icon={Music2} onClick={onClose} />
        <NavLink href="/app/plans" label="Plans" icon={CalendarDays} onClick={onClose} />
        <NavLink href="/app/favorites" label="Favoris" icon={Heart} onClick={onClose} />
        {showAdmin && (
          <NavLink href="/app/admin/users" label="Utilisateurs" icon={Users} onClick={onClose} />
        )}
        <NavLink href="/app/profile" label="Profil" icon={UserCircle} onClick={onClose} />
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-nav-link"
          style={{ color: "var(--color-outline)" }}
        >
          <LogOut size={16} strokeWidth={1.75} />
          Déconnexion
        </button>
      </div>
    </>
  )
}

/** Sidebar desktop fixe (≥ lg) */
export function SideNav({ user }: { user: NavUser }) {
  return (
    <aside className="sidebar hidden lg:flex flex-col">
      <NavContent user={user} role={user.role ?? ""} />
    </aside>
  )
}

/** Bouton hamburger + drawer mobile (< lg) */
export function MobileNav({ user }: { user: NavUser }) {
  // Le menu est lié à la route où il a été ouvert : changer de page le referme sans effet.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const pathname = usePathname()
  const open = openPath === pathname

  // Bloquer le scroll body quand ouvert
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <>
      {/* Topbar mobile */}
      <header
        className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4"
        style={{
          height: "56px",
          background: "var(--color-surface-low)",
          borderBottom: "1px solid var(--color-outline-variant)",
        }}
      >
        <button
          type="button"
          onClick={() => setOpenPath(pathname)}
          className="w-9 h-9 flex items-center justify-center rounded-lg"
          style={{ color: "var(--color-on-surface-variant)" }}
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
        <span className="font-extrabold tracking-tight text-sm" style={{ color: "var(--color-primary)" }}>
          WorshipFlow
        </span>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpenPath(null)}
        />
      )}

      {/* Drawer */}
      <aside
        className="lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col"
        style={{
          width: "var(--sidebar-width)",
          background: "linear-gradient(180deg, #0d1528 0%, #0b1326 100%)",
          borderRight: "1px solid var(--color-outline-variant)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <NavContent user={user} role={user.role ?? ""} onClose={() => setOpenPath(null)} />
      </aside>
    </>
  )
}
