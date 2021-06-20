import * as glob from '@actions/glob'
import { promises as fs } from 'fs'
import * as path from 'path'

export type Kustomization = {
  kustomizationDir: string
  outputFile: string
}

export const globKustomization = async (patterns: string, outputBaseDir: string): Promise<Kustomization[]> => {
  const cwd = process.cwd()
  const globber = await glob.create(patterns, { matchDirectories: false })
  const paths = await globber.glob()

  const kustomizations: Kustomization[] = []
  for (const p of paths) {
    const stat = await fs.stat(p)
    if (!stat.isFile()) {
      continue
    }

    const kustomizationDir = path.dirname(p)
    const relativeDir = path.relative(cwd, kustomizationDir)
    const outputFile = path.join(outputBaseDir, relativeDir, 'generated.yaml')
    kustomizations.push({ kustomizationDir, outputFile })
  }
  return kustomizations
}
