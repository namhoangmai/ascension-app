/** Collects callbacks registered through the mocked `after()` from next/server. */
export const afterQueue: (() => Promise<void> | void)[] = [];

export async function flushAfter() {
  const tasks = afterQueue.splice(0);
  for (const task of tasks) await task();
}
