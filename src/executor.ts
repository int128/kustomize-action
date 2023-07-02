type Task<T> = () => Promise<T>

export const execute = async <T>(queue: Task<T>[], concurrency: number): Promise<T[]> => {
  const workers = []
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker(queue))
  }
  const results = await Promise.all(workers)
  return results.flat()
}

const worker = async <T>(queue: Task<T>[]): Promise<T[]> => {
  const results = []
  for (;;) {
    const task = queue.shift()
    if (task === undefined) {
      return results // end of tasks
    }
    results.push(await task())
  }
}
