import * as core from '@actions/core'
import { run } from './run'

const main = async (): Promise<void> => {
  try {
    await run({
      kustomization: core.getInput('kustomization', { required: true }),
      extraFiles: core.getInput('extra-files'),
      baseDir: core.getInput('base-directory', { required: true }),
      maxProcess: parseInt(core.getInput('max-process', { required: true })),
      writeIndividualFiles: core.getBooleanInput('write-individual-files', { required: true }),
      errorCommentHeader: core.getInput('error-comment-header'),
      errorCommentFooter: core.getInput('error-comment-footer'),
      token: core.getInput('token', { required: true }),
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()
