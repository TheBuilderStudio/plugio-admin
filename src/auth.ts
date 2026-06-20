/**
 * Plugio Admin — NextAuth v5 Configuration
 *
 * Authentication flow:
 * 1. Admin clicks "Sign in with Google"
 * 2. Google OAuth2 redirects back with user profile
 * 3. signIn callback checks email against ADMIN_EMAILS whitelist
 * 4. If not whitelisted → deny access (redirect to error)
 * 5. If whitelisted → session created with HttpOnly cookie
 *
 * Security:
 * - Sessions are JWT-based (default NextAuth strategy)
 * - Cookies: HttpOnly, Secure (in production), SameSite=Lax
 * - No sensitive data stored in the session token
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { ADMIN_EMAILS } from "@/constants";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET,
    }),
  ],

  callbacks: {
    /**
     * Controls whether a user is allowed to sign in.
     * This is the primary authorization gate.
     * Runs on the server — cannot be bypassed from the client.
     */
    async signIn({ user }) {
      if (!user?.email) {
        return false;
      }

      const isAdmin = ADMIN_EMAILS.includes(user.email);

      if (isAdmin) {
        // We log business actions (approve/reject) in server actions.
        console.log(`[AUTH] Admin login: ${user.email}`);
        return true;
      }

      // Unauthorized email — deny access
      // Returning false shows the error page
      return "/unauthorized";
    },

    /**
     * Called whenever a session is checked (e.g., auth() in Server Components).
     * We surface email in session so we can re-validate on every request.
     */
    async session({ session, token }) {
      if (token?.email) {
        session.user.email = token.email as string;
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }
      return token;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login", // errors carry ?error= query param
  },

  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
});
