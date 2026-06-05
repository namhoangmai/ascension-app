import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/server";
import { getFatSecretFood } from "@/features/nutrition/services/fatsecret";

function isValidFoodId(foodId: string | null): foodId is string {
  return Boolean(foodId && /^\d+$/.test(foodId));
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const foodId = searchParams.get("foodId") ?? searchParams.get("food_id");

  if (!isValidFoodId(foodId)) {
    return NextResponse.json({ error: "A numeric foodId is required." }, { status: 400 });
  }

  try {
    const result = await getFatSecretFood(foodId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to import FatSecret food.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
