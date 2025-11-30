import { promises as fs } from 'node:fs'
import * as os from 'node:os'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import { type KustomizeBuildOption, type KustomizeError, kustomizeBuild } from './build.js'
import { formatErrors } from './comment.js'
import { copyExtraFiles } from './copy.js'
import type { Context } from './github.js'
import { globKustomization } from './glob.js'
import * as kustomize from './kustomize.js'

type Inputs = {
  kustomization: string
  extraFiles: string
  baseDir: string
  ignoreKustomizeError: boolean
} & KustomizeBuildOption

export const run = async (inputs: Inputs, context: Context): Promise<void> => {
  // Ensure kustomize is available
  process.chdir(inputs.baseDir)
  await kustomize.run(['version'], inputs)

  const outputBaseDir = await fs.mkdtemp(`${os.tmpdir()}/kustomize-action-`)
  core.info(`Created an output directory: ${outputBaseDir}`)

  const kustomizations = await globKustomization(inputs.kustomization, outputBaseDir)
  const results = await kustomizeBuild(kustomizations, inputs)

  const errors: KustomizeError[] = results.filter((result) => !result.success)
  core.info(`kustomize build finished with ${errors.length} errors`)
  const prettyErrors = formatErrors(errors, context)

  await core.group('Copying the extra files', async () => await copyExtraFiles(inputs.extraFiles, outputBaseDir))

  const outputFilesGlobber = await glob.create(outputBaseDir, { matchDirectories: false })
  const outputFiles = await outputFilesGlobber.glob()
  core.setOutput('directory', outputBaseDir)
  core.setOutput('files', outputFiles.join('\n'))
  core.setOutput('raw-errors', errors.map((error) => error.stderr).join('\n'))
  core.setOutput('pretty-errors', prettyErrors.join('\n'))

  core.summary.addHeading('kustomize-action summary', 2)
  core.summary.addTable([
    [
      { data: 'Directory', header: true },
      { data: 'Build', header: true },
    ],
    ...results.map((result) => [
      result.kustomization.kustomizationDir,
      result.success ? ':white_check_mark: Success' : ':x: Failure',
    ]),
  ])
  if (errors.length > 0) {
    core.summary.addEOL()
    core.summary.addRaw(prettyErrors.join('\n'))
    core.summary.addEOL()
  }
  await core.summary.write()

  if (errors.length > 0 && !inputs.ignoreKustomizeError) {
    throw new Error(`kustomize build finished with ${errors.length} errors`)
  }
}
