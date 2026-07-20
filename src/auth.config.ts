import type { NextAuthConfig } from "next-auth"
import type { Role } from "@prisma/client"

// Configuração compartilhada e edge-safe (sem Prisma/bcrypt) — usada pelo middleware.
export const authConfig = {
  // Confia no Host da requisição → login funciona em qualquer IP/host da rede local
  // (sem isso, host ≠ localhost pode dar UntrustedHost). Não fixar AUTH_URL no .env.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = nextUrl.pathname === "/login"

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl))
        return true
      }
      return isLoggedIn
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
      }
      return session
    },
  },
} satisfies NextAuthConfig
