import { describe, expect, it, vi } from "vitest"
import { runQueue } from "./run-queue"

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe("bulk run queue", () => {
  it("runs every job", async () => {
    const seen: number[] = []
    await runQueue([1, 2, 3, 4], async job => { seen.push(job) }, { concurrency: 2 })
    expect(seen.sort()).toEqual([1, 2, 3, 4])
  })

  it("keeps only as many in flight as allowed", async () => {
    const gates = [deferred(), deferred(), deferred()]
    let started = 0
    const run = runQueue([0, 1, 2], async index => { started++; await gates[index].promise }, { concurrency: 2 })

    await Promise.resolve()
    expect(started).toBe(2)

    gates[0].resolve()
    await Promise.resolve(); await Promise.resolve()
    expect(started).toBe(3)

    gates[1].resolve(); gates[2].resolve()
    await run
  })

  it("carries on after a job fails, and says which one", async () => {
    const settled: [number, boolean][] = []
    await runQueue([1, 2, 3], async job => { if (job === 2) throw new Error("plakat nije čitljiv") },
      { concurrency: 1, onSettled: (job, error) => settled.push([job, error !== null]) })

    expect(settled).toEqual([[1, false], [2, true], [3, false]])
  })

  it("starts no further job once asked to stop", async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    let stop = false
    await runQueue([1, 2, 3], async job => { await run(job); stop = true }, { concurrency: 1, shouldStop: () => stop })

    expect(run).toHaveBeenCalledTimes(1)
  })

  it("does nothing with an empty list", async () => {
    const run = vi.fn()
    await runQueue([], run)
    expect(run).not.toHaveBeenCalled()
  })
})
