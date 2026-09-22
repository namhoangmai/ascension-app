"use server";

import {
  changePassword,
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

export async function signInWithGoogleAction() {
  return signInWithGoogle();
}

export async function signOutCurrentUserAction() {
  return signOutCurrentUser();
}
