/**
 * Zod validation schema tests — covers D-05 (password change schema validation: password mismatch)
 *
 * Implementation notes:
 *   - This is a pure unit test — no mocking required
 *   - Import changePasswordSchema from lib/validations/user.ts and call .safeParse()
 *   - Assert result.success is false and error path includes "confirmPassword" when passwords differ
 *   - D-05: Users can change their own password via profile/settings page; Zod enforces matching
 */

import { changePasswordSchema, createUserSchema } from "@/lib/validations/user";

describe("Zod Validation Schemas — lib/validations/user.ts", () => {
  // AUTH-03 / D-05 | task 01-users-02
  it("changePasswordSchema rejects when newPassword and confirmPassword do not match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Old@123",
      newPassword: "New@123",
      confirmPassword: "Different@123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path);
      expect(paths).toContainEqual(["confirmPassword"]);
    }
  });

  it("changePasswordSchema accepts when newPassword and confirmPassword match", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Old@123",
      newPassword: "New@123!",
      confirmPassword: "New@123!",
    });
    expect(result.success).toBe(true);
  });

  it("createUserSchema rejects invalid email", () => {
    const result = createUserSchema.safeParse({
      name: "Alice",
      email: "bad-email",
      role: "MANAGER",
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("createUserSchema rejects invalid role (not MANAGER or STAFF)", () => {
    const result = createUserSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      role: "ADMIN",
      password: "12345678",
    });
    expect(result.success).toBe(false);
  });

  it("createUserSchema accepts valid input", () => {
    const result = createUserSchema.safeParse({
      name: "Al",
      email: "a@b.com",
      role: "STAFF",
      password: "12345678",
    });
    expect(result.success).toBe(true);
  });
});
