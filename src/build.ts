import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as path from 'path'

export type Kustomization = {
  kustomizationDir: string
  outputFile: string
}

export const kustomizeBuild = async (kustomizations: Kustomization[], maxProcess: number): Promise<void> => {
  const queue = kustomizations.concat()
  const workers: Promise<boolean>[] = []
  for (let index = 0; index < maxProcess; index++) {
    workers.push(worker(queue))
  }
  const anyErrors = await Promise.all(workers)
  if (anyErrors.includes(true)) {
    const count = anyErrors.filter((anyError) => anyError).length
    throw new Error(`kustomize build finished with ${count} error(s)`)
  }
  core.info(`all of kustomize build successfully finished`)
}

const worker = async (queue: Kustomization[]): Promise<boolean> => {
  for (let anyError = false; ; ) {
    const task = queue.shift()
    if (task === undefined) {
      return anyError // end of tasks
    }

    await io.mkdirP(path.dirname(task.outputFile))

    const args = ['build', task.kustomizationDir, '-o', task.outputFile]
    const lines: string[] = []
    const code = await exec.exec('kustomize', args, {
      silent: true,
      ignoreReturnCode: true,
      listeners: {
        stdline: (line) => lines.push(line),
        errline: (line) => lines.push(line),
      },
    })

    core.startGroup(`kustomize build ${task.kustomizationDir}`)
    core.info(lines.join('\n'))
    if (code === 0) {
      core.info(`kustomize ${args.join(' ')} finished with exit code ${code}`)
    } else {
      core.error(`kustomize ${args.join(' ')} finished with exit code ${code}`)
    }
    core.endGroup()

    if (code !== 0) {
      anyError = true
    }
  }
}
