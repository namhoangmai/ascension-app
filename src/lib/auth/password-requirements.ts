export interface PasswordRequirement {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

/**
 * Single source of truth for the password rules shown in the sign-up and
 * reset-password UI. Kept in sync by hand with `passwordPolicySchema` in
 * `./validation.ts` (min length 12, one lowercase, one uppercase, one
 * number) — update both if the policy changes.
 */
export const passwordRequirements: PasswordRequirement[] = [
  {
    id: "length",
    label: "At least 12 characters",
    test: (password) => password.length >= 12
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (password) => /[a-z]/.test(password)
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (password) => /[A-Z]/.test(password)
  },
  {
    id: "number",
    label: "One number",
    test: (password) => /[0-9]/.test(password)
  }
];
