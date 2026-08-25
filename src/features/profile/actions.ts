"use server";

import { saveProfileAction as saveProfile } from "./server";

export async function saveProfileAction(
  previousState: Parameters<typeof saveProfile>[0],
  formData: FormData
) {
  return saveProfile(previousState, formData);
}
