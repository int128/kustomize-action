import * as path from 'node:path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as executor from './executor.js'
import * as kustomize from './kustomize.js'

export type Kustomization = {
  kustomizationDir: string
  outputDir: string
}

export type KustomizeBuildOption = kustomize.RetryOptions & {
  kustomizeBuildArgs: string[]
  maxProcess: number
  writeIndividualFiles: boolean
}

export type KustomizeResult = KustomizeSuccess | KustomizeError

export type KustomizeSuccess = {
  kustomization: Kustomization
  success: true
}

export type KustomizeError = {
  kustomization: Kustomization
  success: false
  stderr: string
}

export const kustomizeBuild = async (
  kustomizations: Kustomization[],
  option: KustomizeBuildOption,
): Promise<KustomizeResult[]> => {
  if (option.maxProcess < 1) {
    throw new Error(`maxProcess must be a positive number but was ${option.maxProcess}`)
  }
  const tasks = []
  for (const kustomization of kustomizations) {
    tasks.push(async () => await build(kustomization, option))
  }
  return await executor.execute(tasks, option.maxProcess)
}

const ansi = {
  reset: '\u001b[0m',
  red: '\u001b[31m',
  blue: '\u001b[34m',
}

const build = async (task: Kustomization, option: KustomizeBuildOption): Promise<KustomizeResult> => {
  await io.mkdirP(task.outputDir)

  const args = ['build', task.kustomizationDir]
  if (option.writeIndividualFiles) {
    args.push('-o', task.outputDir)
  } else {
    args.push('-o', path.join(task.outputDir, 'generated.yaml'))
  }
  args.push(...option.kustomizeBuildArgs)

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
    return {
      kustomization: task,
      success: true,
    }
  }

  const relativeFile = path.join(path.relative('.', task.kustomizationDir), 'kustomization.yaml')
  core.error(`${ansi.red}FAIL${ansi.reset} ${relativeFile}`)
  core.info(`${ansi.blue}kustomize ${args.join(' ')}${ansi.reset} (exit ${output.exitCode})`)
  if (output.stdout) {
    core.info(output.stdout)
  }
  if (output.stderr) {
    core.error(output.stderr, {
      file: relativeFile,
      title: `kustomize build error (exit ${output.exitCode})`,
    })
  }
  return {
    kustomization: task,
    success: false,
    stderr: output.stderr,
  }
}
