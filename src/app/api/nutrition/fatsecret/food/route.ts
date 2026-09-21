import { NextResponse } from "next/server";

import { assertRateLimit, getRateLimitKey, RateLimitError } from "@/lib/auth/rate-limit";
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

  try {
    assertRateLimit({
      key: getRateLimitKey("fatsecret", user.id),
      limit: 30,
      windowMs: 60 * 1000
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    throw error;
  }

  const { searchParams } = new URL(request.url);
  const foodId = searchParams.get("foodId") ?? searchParams.get("food_id");

  if (!isValidFoodId(foodId)) {
    return NextResponse.json({ error: "A numeric foodId is required." }, { status: 400 });
  }

  try {
    const result = await getFatSecretFood(foodId);

    return NextResponse.json(result);
  } catch {
    // Upstream/config error details are not returned to the client.
    return NextResponse.json({ error: "Unable to import FatSecret food." }, { status: 502 });
  }
}
