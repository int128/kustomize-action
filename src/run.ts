import * as core from '@actions/core'
import * as os from 'os'
import { promises as fs } from 'fs'
import { globKustomization } from './glob'
import { kustomizeBuild } from './build'

type Inputs = {
  pattern: string
  baseDir: string
  maxProcess: number
}

export const run = async (inputs: Inputs): Promise<void> => {
  process.chdir(inputs.baseDir)
  const outputBaseDir = await fs.mkdtemp(`${os.tmpdir()}/kustomize-action-`)
  core.setOutput('directory', outputBaseDir)
  core.info(`writing to ${outputBaseDir}`)
  const kustomizations = await globKustomization(inputs.pattern, outputBaseDir)
  await kustomizeBuild(kustomizations, inputs.maxProcess)
}
