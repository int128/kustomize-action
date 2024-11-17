import * as glob from '@actions/glob'
import { promises as fs } from 'fs'
import * as path from 'path'
import { Kustomization } from './build.js'

export const globKustomization = async (patterns: string, outputBaseDir: string): Promise<Kustomization[]> => {
  const globber = await glob.create(patterns, { matchDirectories: false })
  const absKustomizationFiles = await globber.glob()

  const kustomizations: Kustomization[] = []
  for (const absKustomizationFile of absKustomizationFiles) {
    const stat = await fs.stat(absKustomizationFile)
    if (!stat.isFile()) {
      continue
    }

    const absKustomizationDir = path.dirname(absKustomizationFile)
    const kustomizationDir = path.relative('.', absKustomizationDir)
    const outputDir = path.join(outputBaseDir, kustomizationDir)
    kustomizations.push({ kustomizationDir, outputDir })
  }
  return kustomizations
}
