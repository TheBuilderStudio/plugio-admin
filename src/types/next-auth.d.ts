import "next-auth";

declare module "next-auth" {
  interface User {
    backendAdmin?: boolean;
  }
  interface Session {
    user: User & { backendAdmin: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** True when the admin signed in through the backend's admin list rather than ADMIN_EMAILS. */
    backendAdmin?: boolean;
  }
}
