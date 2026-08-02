import type { User } from "@supabase/supabase-js";

export function hasTeacherRole(user: User | null | undefined): boolean {
  const role = user?.app_metadata?.borza_role;
  return role === "teacher" || role === "admin";
}
