import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/components/providers"
import { Toaster } from "sonner"
import { THEME_INIT_SCRIPT } from "@/lib/themeScript"

// Polices auto-hébergées (licence OFL) : aucune dépendance à Google Fonts au build ni à l'exécution.
// Atkinson Hyperlegible Next : conçue pour la lisibilité (interface + paroles).
const atkinson = localFont({
  src: "./fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-atkinson",
})

// Source Serif 4 : titres, ambiance « recueil de chants ».
const sourceSerif = localFont({
  src: [
    { path: "./fonts/source-serif-4-latin-wght-normal.woff2", style: "normal" },
    { path: "./fonts/source-serif-4-latin-wght-italic.woff2", style: "italic" },
  ],
  weight: "200 900",
  display: "swap",
  variable: "--font-source-serif",
})

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f2" },
    { media: "(prefers-color-scheme: dark)", color: "#17120e" },
  ],
}

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Worship Flow", statusBarStyle: "default" },
  title: { default: "Worship Flow", template: "%s · Worship Flow" },
  description: "Chants, partitions et plans de service pour la chorale",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${atkinson.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster richColors position="top-center" />
        </Providers>
      </body>
    </html>
  )
}
