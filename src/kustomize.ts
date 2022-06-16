import * as core from '@actions/core'
import * as exec from '@actions/exec'

type Output = {
  code: number
  message: string
}

export const run = async (args: string[], options?: exec.ExecOptions): Promise<Output> => {
  for (let i = 0; i < 2; i++) {
    const output = await runInternal(args, options)
    if (output.code === 0) {
      return output
    }
    core.warning(`kustomize returned exit code ${output.code}, retrying after 3s`)
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }
  return await run(args, options)
}

const runInternal = async (args: string[], options?: exec.ExecOptions): Promise<Output> => {
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
