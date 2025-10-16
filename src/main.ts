import * as core from '@actions/core'
import { run } from './run.js'

const main = async (): Promise<void> => {
  await run({
    kustomization: core.getInput('kustomization', { required: true }),
    kustomizeBuildArgs: core.getMultilineInput('kustomize-build-args'),
    extraFiles: core.getInput('extra-files'),
    baseDir: core.getInput('base-directory', { required: true }),
    maxProcess: parseInt(core.getInput('max-process', { required: true }), 10),
    retryMaxAttempts: parseInt(core.getInput('retry-max-attempts', { required: true }), 10),
    retryWaitMs: parseInt(core.getInput('retry-wait-ms', { required: true }), 10),
    writeIndividualFiles: core.getBooleanInput('write-individual-files', { required: true }),
    ignoreKustomizeError: core.getBooleanInput('ignore-kustomize-error'),
    errorComment: core.getBooleanInput('error-comment', { required: true }),
    errorCommentHeader: core.getInput('error-comment-header'),
    errorCommentFooter: core.getInput('error-comment-footer'),
    token: core.getInput('token', { required: true }),
  })
}

main().catch((e: Error) => {
  core.setFailed(e)
  console.error(e)
})
