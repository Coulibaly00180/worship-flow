"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { clearOfflineCaches } from "@/lib/offline"
import { Music, Calendar, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

type NavUser = {
  name?: string | null
  email?: string | null
  role?: string
}

const navLinks = [
  { href: "/app/songs", label: "Chants", icon: Music },
  { href: "/app/plans", label: "Plans", icon: Calendar },
]

export function AppNav({ user }: { user: NavUser }) {
  const pathname = usePathname()

  return (
    <header className="border-b bg-white dark:bg-gray-900 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        <span className="font-semibold text-gray-900 dark:text-white mr-4">Church Presenter</span>

        <nav className="flex gap-1 flex-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{user.name}</span>
          <button
            type="button"
            onClick={async () => { await clearOfflineCaches(); await signOut({ callbackUrl: "/login" }) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-600 hover:text-red-600 dark:text-gray-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  )
}
