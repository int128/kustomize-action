import * as path from 'node:path'
import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as io from '@actions/io'

export const copyExtraFiles = async (patterns: string, outputBaseDir: string): Promise<void> => {
  const cwd = process.cwd()
  const globber = await glob.create(patterns, { matchDirectories: false })
  for await (const source of globber.globGenerator()) {
    const relativePath = path.relative(cwd, source)
    const destination = path.join(outputBaseDir, relativePath)
    core.info(`Copy ${source} -> ${destination}`)
    await io.mkdirP(path.dirname(destination))
    await io.cp(source, destination)
  }
}
