/**
 * User management tests — covers D-03 (Manager creates user) and D-05 (wrong current password rejected)
 *
 * Implementation notes:
 *   - All tests will require mocking prisma.user.create / prisma.user.findUnique and bcryptjs.compare
 *   - D-03: No self-registration — all accounts created by a Manager via createUser Server Action
 *   - D-04: Manager fills in name, email, role, and initial password (no forced password change on first login)
 *   - D-05: Users can change their own password; wrong current password must be rejected
 */

describe("User Management — actions/users.ts", () => {
  // AUTH-03 / D-03 | task 01-users-01
  // Implementation: mock prisma.user.create to return the created user; call createUser Server Action
  // with valid payload { name, email, role: "STAFF", password }
  // Assert: prisma.user.create was called with hashed password and correct fields
  it.todo("Manager creating a user with valid data results in the user being saved to the database");

  // AUTH-03 / D-05 | task 01-users-03
  // Implementation: mock prisma.user.findUnique to return a user, mock bcryptjs.compare to return false
  // Assert: changePassword Server Action returns an error (e.g., { error: "Current password is incorrect" })
  //         and prisma.user.update is NOT called
  it.todo("Attempting password change with wrong current password returns an error");
});
