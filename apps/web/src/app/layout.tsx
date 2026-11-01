import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"

// Police auto-hébergée (OFL) : pas de dépendance à Google Fonts au build ni à l'exécution
const manrope = localFont({
  src: "./fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-sans",
})

export const viewport: Viewport = {
  themeColor: "#0b1326",
}

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Chantres", statusBarStyle: "black-translucent" },
  title: "Church Presenter — Chantres",
  description: "Application de gestion des chants pour les chantres",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className={manrope.className} suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
