import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as path from 'path'

export type Kustomization = {
  kustomizationDir: string
  outputDir: string
}

export type KustomizeBuildOption = {
  maxProcess: number
  writeIndividualFiles: boolean
}

export type KustomizeError = {
  kustomization: Kustomization
  code: number
  message: string
}

export const kustomizeBuild = async (
  kustomizations: Kustomization[],
  option: KustomizeBuildOption
): Promise<KustomizeError[]> => {
  if (option.maxProcess < 1) {
    throw new Error(`maxProcess must be a positive number but was ${option.maxProcess}`)
  }

  const queue = kustomizations.concat()
  const workers: Promise<KustomizeError[]>[] = []
  for (let index = 0; index < option.maxProcess; index++) {
    workers.push(worker(queue, option))
  }
  const errorsOfWorkers = await Promise.all(workers)
  const errors = ([] as KustomizeError[]).concat(...errorsOfWorkers)
  return errors
}

const worker = async (queue: Kustomization[], option: KustomizeBuildOption): Promise<KustomizeError[]> => {
  for (const errors: KustomizeError[] = []; ; ) {
    const task = queue.shift()
    if (task === undefined) {
      return errors // end of tasks
    }
    const result = await build(task, option)
    if (result !== undefined) {
      errors.push(result)
    }
  }
}

const build = async (task: Kustomization, option: KustomizeBuildOption): Promise<KustomizeError | void> => {
  await io.mkdirP(task.outputDir)

  let args
  if (option.writeIndividualFiles) {
    args = ['build', task.kustomizationDir, '-o', task.outputDir]
  } else {
    args = ['build', task.kustomizationDir, '-o', path.join(task.outputDir, 'generated.yaml')]
  }
  const lines: string[] = []
  const code = await exec.exec('kustomize', args, {
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdline: (line) => lines.push(line),
      errline: (line) => lines.push(line),
    },
  })
  const message = lines.join('\n')

  if (code === 0) {
    core.startGroup(task.kustomizationDir)
    core.info(`kustomize ${args.join(' ')} finished with exit code ${code}`)
    core.info(message)
    core.endGroup()
    return
  }

  core.startGroup(`\u001b[31mFAIL\u001b[0m ${task.kustomizationDir}`)
  core.error(`kustomize ${args.join(' ')} finished with exit code ${code}`)
  core.info(message)
  core.endGroup()
  return { code, message, kustomization: task }
}
