import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as os from 'os'
import { promises as fs } from 'fs'
import { globKustomization } from './glob'
import { kustomizeBuild } from './build'
import { copyExtraFiles } from './copy'

type Inputs = {
  kustomization: string
  extraFiles: string
  baseDir: string
  maxProcess: number
  writeIndividualFiles: boolean
}

export const run = async (inputs: Inputs): Promise<void> => {
  process.chdir(inputs.baseDir)
  const outputBaseDir = await fs.mkdtemp(`${os.tmpdir()}/kustomize-action-`)
  core.setOutput('directory', outputBaseDir)
  core.info(`writing to ${outputBaseDir}`)

  const kustomizations = await globKustomization(inputs.kustomization, outputBaseDir)
  await kustomizeBuild(kustomizations, inputs)
  await copyExtraFiles(inputs.extraFiles, outputBaseDir)

  const globber = await glob.create(outputBaseDir, { matchDirectories: false })
  const outputFiles = await globber.glob()
  core.setOutput('files', outputFiles.join('\n'))
}
