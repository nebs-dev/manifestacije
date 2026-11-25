/**
 * Runs a list of jobs a few at a time.
 *
 * Twenty posters each cost an LLM call of their own, so firing them all at
 * once would hit the provider's rate limit and lose work that was already
 * paid for. A small number in flight keeps the run steady and the progress
 * readable.
 *
 * Every job is reported through `onSettled` whether it succeeded or threw: a
 * poster that fails must not stop the other nineteen, and the caller needs to
 * know which one to retry. `shouldStop` is checked before each job starts, so
 * stopping leaves the jobs already running to finish rather than abandoning
 * work in flight.
 */
export async function runQueue<T>(
  jobs: T[],
  run: (job: T) => Promise<void>,
  options: { concurrency?: number; shouldStop?: () => boolean; onSettled?: (job: T, error: unknown) => void } = {},
): Promise<void> {
  const concurrency = Math.max(1, options.concurrency ?? 2)
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    for (;;) {
      if (options.shouldStop?.()) return
      const index = next++
      if (index >= jobs.length) return
      const job = jobs[index]
      try {
        await run(job)
        options.onSettled?.(job, null)
      } catch (error) {
        options.onSettled?.(job, error ?? new Error("Nepoznata greška"))
      }
    }
  })
  await Promise.all(workers)
}
