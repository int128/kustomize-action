import * as core from '@actions/core'

import { LoadRestrictor, run } from './run'

const main = async (): Promise<void> => {
  await run({
    kustomization: core.getInput('kustomization', { required: true }),
    extraFiles: core.getInput('extra-files'),
    baseDir: core.getInput('base-directory', { required: true }),
    maxProcess: parseInt(core.getInput('max-process', { required: true })),
    retryMaxAttempts: parseInt(core.getInput('retry-max-attempts', { required: true })),
    retryWaitMs: parseInt(core.getInput('retry-wait-ms', { required: true })),
    writeIndividualFiles: core.getBooleanInput('write-individual-files', { required: true }),
    ignoreKustomizeError: core.getBooleanInput('ignore-kustomize-error'),
    errorComment: core.getBooleanInput('error-comment', { required: true }),
    errorCommentHeader: core.getInput('error-comment-header'),
    errorCommentFooter: core.getInput('error-comment-footer'),
    token: core.getInput('token', { required: true }),
    loadRestrictor:
      LoadRestrictor[
        (core.getInput('load-restrictor') !== ''
          ? core.getInput('load-restrictor')
          : 'LoadRestrictionsRootOnly') as keyof typeof LoadRestrictor
      ],
  })
}

main().catch((e) => core.setFailed(e instanceof Error ? e : String(e)))
