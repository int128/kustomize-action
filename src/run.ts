import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import * as os from 'os'
import { promises as fs } from 'fs'
import { globKustomization } from './glob'
import { kustomizeBuild } from './build'
import { copyExtraFiles } from './copy'
import { commentErrors, summaryErrors } from './comment'
import * as kustomize from './kustomize'

type Inputs = {
  kustomization: string
  extraFiles: string
  baseDir: string
  maxProcess: number
  writeIndividualFiles: boolean
  ignoreKustomizeError: boolean
  errorComment: boolean
  errorCommentHeader: string
  errorCommentFooter: string
  token: string
} & kustomize.RetryOptions

export const run = async (inputs: Inputs): Promise<void> => {
  // ensure kustomize is available
  process.chdir(inputs.baseDir)
  await kustomize.run(['version'], inputs)

  const outputBaseDir = await fs.mkdtemp(`${os.tmpdir()}/kustomize-action-`)
  core.setOutput('directory', outputBaseDir)
  core.info(`writing to ${outputBaseDir}`)

  const kustomizations = await globKustomization(inputs.kustomization, outputBaseDir)
  const errors = await kustomizeBuild(kustomizations, inputs)
  if (inputs.ignoreKustomizeError) {
    core.info(`kustomize finished with ${errors.length} error(s)`)
  } else {
    if (errors.length > 0) {
      await summaryErrors(errors)
      if (inputs.errorComment) {
        const octokit = github.getOctokit(inputs.token)
        await commentErrors(octokit, errors, { header: inputs.errorCommentHeader, footer: inputs.errorCommentFooter })
      }
      throw new Error(`kustomize build finished with ${errors.length} error(s)`)
    }
    core.info(`all of kustomize build successfully finished`)
  }

  await copyExtraFiles(inputs.extraFiles, outputBaseDir)

  const globber = await glob.create(outputBaseDir, { matchDirectories: false })
  const outputFiles = await globber.glob()
  core.setOutput('files', outputFiles.join('\n'))
}
