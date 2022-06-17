import * as core from '@actions/core'
import * as exec from '@actions/exec'

type Options = exec.ExecOptions & RetryOptions

export type RetryOptions = {
  retryWaitMs: number
  retryMaxAttempts: number
}

type Result = {
  code: number
  message: string
}

export const run = async (args: string[], options: Options): Promise<Result> => {
  for (let i = 0; i < options.retryMaxAttempts; i++) {
    const output = await runInternal(args, options)
    if (output.code === 0) {
      return output
    }
    core.warning(`kustomize returned exit code ${output.code}, retrying after ${options.retryWaitMs / 1000}s`)
    await new Promise((resolve) => setTimeout(resolve, options.retryWaitMs))
  }
  return await runInternal(args, options)
}

const runInternal = async (args: string[], options: exec.ExecOptions): Promise<Result> => {
  const lines: string[] = []
  const code = await exec.exec('kustomize', args, {
    ...options,
    ignoreReturnCode: true,
    listeners: {
      stdline: (line) => lines.push(line),
      errline: (line) => lines.push(line),
    },
  })
  const message = lines.join('\n')
  return { code, message }
}
