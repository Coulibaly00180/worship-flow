import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

const nextAuth = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const login = credentials.email as string
        // Connexion par email ou par pseudo
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: login },
              { username: login },
            ],
          },
        })

        if (!user || !user.isActive) return null

        const valid = await compare(credentials.password as string, user.passwordHash)
        if (!valid) return null

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
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as { id?: string; role?: string; username?: string; firstName?: string; lastName?: string }
        token.id = u.id
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
            select: { username: true, firstName: true, lastName: true, name: true, isActive: true, role: true },
          })
          if (!fresh || !fresh.isActive) {
            // Compte désactivé ou supprimé — session invalidée (auth() renverra null)
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
