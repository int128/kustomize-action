import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  try {
    await run({
      pattern: core.getInput('pattern', { required: true }),
      baseDir: core.getInput('base-directory', { required: true }),
      maxProcess: parseInt(core.getInput('max-process', { required: true })),
      writeIndividualFiles: core.getBooleanInput('write-individual-files', { required: true }),
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
