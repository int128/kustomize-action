import * as core from '@actions/core'
import type { Octokit } from '@octokit/action'
import type { KustomizeError } from './build.js'
import type { Context } from './github.js'

type CommentOptions = {
  header: string
  footer: string
}

export const commentErrors = async (
  body: string,
  o: CommentOptions,
  octokit: Octokit,
  context: Context,
): Promise<void> => {
  const issueNumber = inferIssueNumber(context)
  if (issueNumber === undefined) {
    return
  }

  const { data } = await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: issueNumber,
    body: [o.header, body, o.footer].join('\n'),
  })
  core.info(`Created a comment as ${data.html_url}`)
}

const inferIssueNumber = (context: Context): number | undefined => {
  if ('pull_request' in context.payload) {
    return context.payload.pull_request.number
  }
}

export const formatErrors = (errors: KustomizeError[], context: Context): string[] => {
  return errors.map((error) => errorTemplate(error, context))
}

const errorTemplate = (e: KustomizeError, context: Context): string => {
  return `
### ${e.kustomization.kustomizationDir}
[kustomization.yaml](${kustomizationUrl(e.kustomization.kustomizationDir, context)}) error:
\`\`\`
${e.stderr.replaceAll('\n', '').replaceAll(':', ':\n')}
\`\`\`
`
}

const kustomizationUrl = (directory: string, context: Context) =>
  `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/blob/${context.sha}/${directory}/kustomization.yaml`
