"use server";

import { saveProfileAction as saveProfile, updateAccountDetails } from "./server";

export async function saveProfileAction(
  previousState: Parameters<typeof saveProfile>[0],
  formData: FormData
) {
  return saveProfile(previousState, formData);
}

export async function updateAccountDetailsAction(
  previousState: Parameters<typeof updateAccountDetails>[0],
  formData: FormData
) {
  return updateAccountDetails(previousState, formData);
}
