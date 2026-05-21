# Access Model

Ascension stores private user data and public seed data in the same PostgreSQL database. Phase 2 authentication must enforce this access model in every server action, route handler, repository, and service.

## Rules

1. Users can read and write their own private records.
2. Users can read public seeded records.
3. Users must never read, mutate, reference, or infer another user's private records.
4. Mutations are allowed only on user-owned records unless a privileged seed/admin process is running.
5. Signed upload or download URLs are generated at runtime and are never persisted.

## Exercises

Exercises support both public seeded records and private custom records.

- Public seeded exercise: `ownerId = null`, `isPublic = true`, `sourceKey = seed:exercise:<stable-slug>`
- Custom user exercise: `ownerId = <userId>`, `isPublic = false`, `sourceKey = user:<userId>:exercise:<stable-slug>`

Queries must use `accessibleExerciseWhere(userId, where)`.
Mutations must use `privateExerciseWhere(userId, where)` unless running a seed/admin import.

Workout history stores exercise snapshots on `SessionExercise`, so later edits to an exercise do not rewrite historical logs.

## Foods

Foods support seeded, OpenFoodFacts, and private custom records.

- Seeded food: `sourceKey = seed:food:<stable-slug>`
- OpenFoodFacts food: `sourceKey = off:<external-id-or-barcode>`
- Custom user food: `sourceKey = user:<userId>:food:<stable-slug>`

Queries must use `accessibleFoodWhere(userId, where)`.
Mutations must use `privateFoodWhere(userId, where)` for custom foods.

Food logs snapshot the name, brand, per-100g nutrition values, and calculated logged macros so historical nutrition does not change when a food record is corrected later.

## Saved Meals

Saved meals are always private user records.

Queries and mutations must use `ownedSavedMealWhere(userId, where)`.
Saved meal items can reference accessible public foods or same-user custom foods only. This cross-owner rule must be validated in the saved meal service before creation or update.

## Body Photos

`BodyPhoto` stores only durable metadata:

- `storageKey`
- content metadata
- view and timestamp
- note

Runtime services generate short-lived signed URLs after confirming ownership. Signed URLs are bearer credentials and must not be stored in PostgreSQL.

## Supabase RLS Assumption

PostgreSQL access from the Next.js server uses Prisma with server-side ownership guards. Supabase Storage must also enforce private buckets and scoped object paths such as:

```text
users/<userId>/body-photos/<photoId>.<ext>
```

Storage reads and writes must be mediated by server routes or server actions that verify the Auth.js session user id.

## Body Measurements

Standard measurements use `MeasurementType` and a normalized `labelKey`.

- Standard example: `type = CHEST`, `labelKey = chest`, `customLabel = null`
- Custom example: `type = CUSTOM`, `labelKey = custom:neck`, `customLabel = Neck`

Custom labels are valid only when `type = CUSTOM`. Services must use `buildMeasurementLabelKey` before inserting measurements.
