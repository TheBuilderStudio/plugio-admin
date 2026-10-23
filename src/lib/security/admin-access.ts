import { isAdminEmail } from "@/lib/security/emails";

/**
 * The one rule for "is this signed-in person an admin right now?", shared by every server-side check.
 *
 * - An email in ADMIN_EMAILS is an admin.
 * - Anyone else is an admin only if they signed in through the backend's admin list (the session flag) AND the backend
 *   still says they are active. The backend is asked every time, so deactivating someone takes effect at once rather
 *   than when their session ends. A session without the flag is never enough, whatever the backend would say.
 *
 * @param isActiveInBackend asks the backend; injected so this rule can be tested without a network
 */
export async function hasAdminAccess(
  email: string | null | undefined,
  signedInViaBackendList: boolean,
  isActiveInBackend: (email: string) => Promise<boolean>,
): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  if (!signedInViaBackendList) return false;
  return isActiveInBackend(email.trim().toLowerCase());
}
