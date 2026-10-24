import { requireCapability } from "@/lib/admin-access";

/** The log viewer is a client page, so the role check lives here, on the server. */
export default async function LogsLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("VIEW_LOGS");
  return children;
}
