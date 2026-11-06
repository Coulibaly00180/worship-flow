import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare, hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { MAX_FAILURES, lockRemaining, recordFailure, recordSuccess } from "@/lib/rateLimit"
import { clientIp } from "@/lib/clientIp"

// Trois compteurs complémentaires :
//  - compte + IP (5 échecs) : bloque un attaquant sans verrouiller le vrai titulaire du compte depuis chez lui ;
//  - IP seule (30) : plus large, plusieurs fidèles peuvent partager le même Wi-Fi ;
//  - compte seul (50) : plafond contre une attaque répartie sur beaucoup d'adresses.
const IP_MAX_FAILURES = 30
const ACCOUNT_MAX_FAILURES = 50

// Hash factice (calculé une fois) pour comparer en temps constant quand le compte n'existe pas
let dummyHash: Promise<string> | undefined
function getDummyHash() {
  dummyHash ??= hash("dummy-password-not-a-secret", 12)
  return dummyHash
}

const nextAuth = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const login = (credentials.email as string).trim()
        if (login.length > 200 || (credentials.password as string).length > 200) return null
        const ip = clientIp(request?.headers)
        const account = login.toLowerCase()
        const pairKey = `pair:${account}|${ip}`
        const accountKey = `login:${account}`
        const ipKey = `ip:${ip}`

        // Trop de tentatives : on refuse sans même consulter la base ni comparer le mot de passe
        const locks = await Promise.all([lockRemaining(pairKey), lockRemaining(accountKey), lockRemaining(ipKey)])
        if (locks.some((ms) => ms > 0)) return null

        // Connexion par email (sans tenir compte de la casse) ou par pseudo
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: login, mode: "insensitive" } },
              { username: login },
            ],
          },
        })

        // Compte inconnu : on compare quand même à un hash factice (pas d'énumération par le temps de réponse)
        const valid = await compare(credentials.password as string, user?.passwordHash ?? (await getDummyHash()))
        if (!user || !user.isActive || !valid) {
          const now = Date.now()
          await Promise.all([
            recordFailure(pairKey, now, MAX_FAILURES),
            recordFailure(accountKey, now, ACCOUNT_MAX_FAILURES),
            recordFailure(ipKey, now, IP_MAX_FAILURES),
          ])
          return null
        }
        // Le compteur par IP n'est pas remis à zéro : il protège aussi les autres comptes
        await Promise.all([recordSuccess(pairKey), recordSuccess(accountKey)])

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          sessionVersion: user.sessionVersion,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string; username?: string; firstName?: string; lastName?: string; sessionVersion?: number }
        token.id = u.id
        token.sv = u.sessionVersion ?? 0
        token.role = u.role
        token.username = u.username
        token.firstName = u.firstName
        token.lastName = u.lastName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.username = token.username as string
        session.user.firstName = token.firstName as string
        session.user.lastName = token.lastName as string
        // Resynchroniser username depuis la BDD (l'utilisateur peut l'avoir changé)
        if (token.id) {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { username: true, firstName: true, lastName: true, name: true, isActive: true, role: true, sessionVersion: true },
          })
          // Jetons émis avant l'ajout de la version de session : considérés comme version 0
          const tokenVersion = typeof token.sv === "number" ? token.sv : 0
          if (!fresh || !fresh.isActive || fresh.sessionVersion !== tokenVersion) {
            // Compte désactivé ou supprimé, ou mot de passe changé depuis la connexion :
            // session invalidée (auth() renverra null)
            return { ...session, user: { ...session.user, id: "", role: "" } }
          }
          // Le rôle est relu en base : une rétrogradation s'applique immédiatement
          session.user.role = fresh.role
          session.user.username = fresh.username
          session.user.firstName = fresh.firstName
          session.user.lastName = fresh.lastName
          session.user.name = fresh.name
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
})

export const { handlers, signIn, signOut } = nextAuth

/**
 * Retourne la session uniquement si le compte existe et est actif.
 * Un compte désactivé/supprimé (id vidé par le callback session) donne null,
 * ce qui déclenche les 401 des routes API et les redirections des pages.
 */
export async function auth() {
  const session = await nextAuth.auth()
  if (!session?.user?.id) return null
  return session
}
