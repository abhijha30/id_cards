import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  // Pages and actions call requireAdmin() again: a layout does not re-run on every navigation.
  const { user } = await requireAdmin();
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
