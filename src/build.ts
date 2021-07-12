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

export const kustomizeBuild = async (kustomizations: Kustomization[], option: KustomizeBuildOption): Promise<void> => {
  if (option.maxProcess < 1) {
    throw new Error(`maxProcess must be a positive number but was ${option.maxProcess}`)
  }

  const queue = kustomizations.concat()
  const workers: Promise<boolean>[] = []
  for (let index = 0; index < option.maxProcess; index++) {
    workers.push(worker(queue, option))
  }
  const anyErrors = await Promise.all(workers)
  if (anyErrors.includes(true)) {
    const count = anyErrors.filter((anyError) => anyError).length
    throw new Error(`kustomize build finished with ${count} error(s)`)
  }
  core.info(`all of kustomize build successfully finished`)
}

const worker = async (queue: Kustomization[], option: KustomizeBuildOption): Promise<boolean> => {
  for (let anyError = false; ; ) {
    const task = queue.shift()
    if (task === undefined) {
      return anyError // end of tasks
    }
    const code = await build(task, option)
    if (code !== 0) {
      anyError = true
    }
  }
}

const build = async (task: Kustomization, option: KustomizeBuildOption): Promise<number> => {
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

  if (code === 0) {
    core.startGroup(task.kustomizationDir)
    core.info(`kustomize ${args.join(' ')} finished with exit code ${code}`)
    core.info(lines.join('\n'))
    core.endGroup()
    return code
  }

  core.startGroup(`\u001b[31mFAIL\u001b[0m ${task.kustomizationDir}`)
  core.error(`kustomize ${args.join(' ')} finished with exit code ${code}`)
  core.info(lines.join('\n'))
  core.endGroup()
  return code
}
