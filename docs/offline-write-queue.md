# Offline Write Queue Architecture

Workout logging must remain fast even with weak gym connectivity. PWA asset caching is not enough; the product needs a deliberate offline write queue once active logging is implemented.

## Goals

- Set entry must feel instant.
- Completed sets should not disappear during connection loss.
- Server state should converge without duplicate sets.
- Conflict handling should be predictable and quiet.

## Proposed Design

1. Client creates optimistic workout mutations with stable client ids.
2. Mutations are stored in IndexedDB immediately.
3. UI reads from local optimistic state first, then reconciles with server acknowledgements.
4. A background sync worker flushes queued mutations when online.
5. Server actions are idempotent by `clientMutationId`.
6. Server returns canonical row ids and updated timestamps.
7. Client marks queue items as acknowledged and patches local ids to server ids.

## Mutation Types

- start workout session
- add session exercise
- reorder session exercise
- add set
- edit set
- complete set
- delete set
- finish workout session

## Server Requirements

- Add `clientMutationId` or operation id table before offline mode ships.
- Use transactions for multi-row workout mutations.
- Scope every mutation by authenticated `userId`.
- Reject references to another user's private exercises.

## Conflict Policy

For active workout logging, last-write-wins is acceptable for draft fields, but destructive actions should record tombstones until acknowledged. Completed workout history should prefer append/update semantics over hard deletes where practical.
