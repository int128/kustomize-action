import * as core from '@actions/core'
import * as exec from '@actions/exec'

type Options = exec.ExecOptions & RetryOptions

export type RetryOptions = {
  retryWaitMs: number
  retryMaxAttempts: number
}

export const run = async (args: string[], options: Options): Promise<exec.ExecOutput> => {
  for (let i = 0; i < options.retryMaxAttempts; i++) {
    const output = await exec.getExecOutput('kustomize', args, {
      ...options,
      ignoreReturnCode: true,
    })
    if (output.exitCode === 0) {
      return output
    }
    core.info(`kustomize returned exit code ${output.exitCode}, retrying after ${options.retryWaitMs / 1000}s`)
    await new Promise((resolve) => setTimeout(resolve, options.retryWaitMs))
  }
  return await exec.getExecOutput('kustomize', args, {
    ...options,
    ignoreReturnCode: true,
  })
}
