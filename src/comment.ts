import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHub } from '@actions/github/lib/utils'
import * as path from 'path'
import { KustomizeError } from './build'

type Octokit = InstanceType<typeof GitHub>

export const commentErrors = async (octokit: Octokit, errors: KustomizeError[], header: string): Promise<void> => {
  if (github.context.payload.pull_request === undefined) {
    return
  }

  const body = `
${header}
${errors.map(errorTemplate).join('\n')}
`

  const { data } = await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.payload.pull_request.number,
    body,
  })
  core.info(`created a comment as ${data.html_url}`)
}

const errorTemplate = (e: KustomizeError): string => {
  const relativeDir = path.relative('.', e.kustomization.kustomizationDir)
  return `
### ${relativeDir}
\`\`\`
${e.message}
\`\`\`
`
}
