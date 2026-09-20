import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().max(254, "That email address is too long.").pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(200),
});

/** Only allow post-login redirects that stay inside the admin area. */
export function safeAdminRedirect(next: string | null | undefined): string {
  if (!next) return "/admin";
  if (!next.startsWith("/admin")) return "/admin";
  if (next.startsWith("//") || next.includes("\\") || next.includes("://")) return "/admin";
  if (next === "/admin/login" || next.startsWith("/admin/login?")) return "/admin";
  return next;
}
