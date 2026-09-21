import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(254, "Email is too long.")
  .transform((email) => email.toLowerCase());

export const passwordPolicySchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Password is too long.")
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean().default(true)
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(80, "Name is too long."),
    email: emailSchema,
    password: passwordPolicySchema,
    confirmPassword: z.string(),
    remember: z.boolean().default(true)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, "Reset token is invalid.").max(256, "Reset token is invalid."),
    password: passwordPolicySchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
