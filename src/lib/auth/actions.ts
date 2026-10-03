"use server";

import {
  changePassword,
  changePasswordWithCode,
  requestPasswordChangeCode,
  requestPasswordReset,
  resendVerificationCodeFromForm,
  resetPassword,
  signInWithGoogle,
  signInWithPassword,
  signOutCurrentUser,
  signUpWithPassword,
  verifyEmailCodeFromForm,
  type AuthActionState
} from "./server";

export async function signInWithPasswordAction(previousState: AuthActionState, formData: FormData) {
  return signInWithPassword(previousState, formData);
}

export async function signUpWithPasswordAction(previousState: AuthActionState, formData: FormData) {
  return signUpWithPassword(previousState, formData);
}

export async function requestPasswordResetAction(
  previousState: AuthActionState,
  formData: FormData
) {
  return requestPasswordReset(previousState, formData);
}

export async function resetPasswordAction(previousState: AuthActionState, formData: FormData) {
  return resetPassword(previousState, formData);
}

export async function verifyEmailCodeAction(previousState: AuthActionState, formData: FormData) {
  return verifyEmailCodeFromForm(previousState, formData);
}

export async function resendVerificationCodeAction(
  previousState: AuthActionState,
  formData: FormData
) {
  return resendVerificationCodeFromForm(previousState, formData);
}

export async function changePasswordAction(previousState: AuthActionState, formData: FormData) {
  return changePassword(previousState, formData);
}

// Zero declared params: `requestPasswordChangeCode()` takes none, and a function with fewer
// params is structurally assignable to `useActionState`'s expected `(state, payload) => State`
// shape (TypeScript/JS both allow calling a function with more args than it declares), so this
// still works as a `useActionState` action if the caller wants that for pending/error UI.
export async function requestPasswordChangeCodeAction() {
  return requestPasswordChangeCode();
}

export async function changePasswordWithCodeAction(
  previousState: AuthActionState,
  formData: FormData
) {
  return changePasswordWithCode(previousState, formData);
}

export async function signInWithGoogleAction() {
  return signInWithGoogle();
}

export async function signOutCurrentUserAction() {
  return signOutCurrentUser();
}
