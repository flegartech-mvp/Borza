import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { hasTeacherRole } from "./roles";

function userWith(metadata: Record<string, unknown>): User {
  return metadata as unknown as User;
}

describe("teacher role boundary", () => {
  it("accepts only protected teacher or admin app metadata", () => {
    expect(
      hasTeacherRole(userWith({ app_metadata: { borza_role: "teacher" } })),
    ).toBe(true);
    expect(
      hasTeacherRole(userWith({ app_metadata: { borza_role: "admin" } })),
    ).toBe(true);
    expect(
      hasTeacherRole(userWith({ app_metadata: { borza_role: "learner" } })),
    ).toBe(false);
    expect(
      hasTeacherRole(userWith({ user_metadata: { borza_role: "teacher" } })),
    ).toBe(false);
  });
});
