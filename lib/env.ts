import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  anonKey: z.string().min(20, "NEXT_PUBLIC_SUPABASE_ANON_KEY looks too short"),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/**
 * Reads the public Supabase settings. NEXT_PUBLIC_* variables must be referenced literally
 * so Next.js can inline them into the browser bundle.
 */
export function getSupabaseEnv(): SupabaseEnv {
  const parsed = supabaseEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  });
  if (!parsed.success) {
    throw new SupabaseConfigError(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "(see .env.example).",
    );
  }
  return parsed.data;
}

export function isSupabaseConfigured(): boolean {
  return supabaseEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  }).success;
}
