import * as core from '@actions/core'
import * as io from '@actions/io'
import * as path from 'path'
import * as kustomize from './kustomize'

export type Kustomization = {
  kustomizationDir: string
  outputDir: string
}

export type KustomizeBuildOption = kustomize.RetryOptions & {
  maxProcess: number
  writeIndividualFiles: boolean
  showErrorAnnotation: boolean
}

export type KustomizeError = {
  kustomization: Kustomization
  stderr: string
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

const ansi = {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  blue: '\u001b[34m',
}

const build = async (task: Kustomization, option: KustomizeBuildOption): Promise<KustomizeError | void> => {
  await io.mkdirP(task.outputDir)

  let args
  if (option.writeIndividualFiles) {
    args = ['build', task.kustomizationDir, '-o', task.outputDir]
  } else {
    args = ['build', task.kustomizationDir, '-o', path.join(task.outputDir, 'generated.yaml')]
  }
  const output = await kustomize.run(args, {
    ...option,
    silent: true, // prevent logs in parallel
  })

  if (output.exitCode === 0) {
    core.startGroup(task.kustomizationDir)
    core.info(`${ansi.blue}kustomize ${args.join(' ')}`)
    if (output.stdout) {
      core.info(output.stdout)
    }
    if (output.stderr) {
      core.info(output.stderr)
    }
    core.endGroup()
    return
  }

  const relativeFile = path.join(path.relative('.', task.kustomizationDir), 'kustomization.yaml')
  core.error(`${ansi.red}FAIL${ansi.reset} ${relativeFile}`)
  core.info(`${ansi.blue}kustomize ${args.join(' ')}${ansi.reset} (exit ${output.exitCode})`)
  if (output.stdout) {
    core.info(output.stdout)
  }
  if (output.stderr) {
    if (option.showErrorAnnotation) {
      core.error(output.stderr, {
        file: relativeFile,
        title: `kustomize build error (exit ${output.exitCode})`,
      })
    } else {
      core.info(output.stderr)
    }
  }
  return {
    stderr: output.stderr,
    kustomization: task,
  }
}
