import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      username: string
      firstName: string
      lastName: string
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    username?: string
    firstName?: string
    lastName?: string
    /** Version de session du compte au moment de la connexion (voir User.sessionVersion) */
    sv?: number
  }
}
