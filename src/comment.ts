import * as core from '@actions/core'
import * as github from '@actions/github'
import { KustomizeError } from './build.js'

type Octokit = ReturnType<typeof github.getOctokit>

type CommentOptions = {
  header: string
  footer: string
}

export const commentErrors = async (octokit: Octokit, body: string, o: CommentOptions): Promise<void> => {
  if (github.context.payload.pull_request === undefined) {
    return
  }

  const { data } = await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.payload.pull_request.number,
    body: [o.header, body, o.footer].join('\n'),
  })
  core.info(`created a comment as ${data.html_url}`)
}

export const formatErrors = (errors: KustomizeError[]): string[] => {
  return errors.map(errorTemplate)
}

const errorTemplate = (e: KustomizeError): string => {
  return `
### ${e.kustomization.kustomizationDir}
[kustomization.yaml](${kustomizationUrl(e.kustomization.kustomizationDir)}) error:
\`\`\`
${e.stderr.replaceAll('\n', '').replaceAll(':', ':\n')}
\`\`\`
`
}

const kustomizationUrl = (directory: string) => {
  const { serverUrl, repo, sha } = github.context
  return `${serverUrl}/${repo.owner}/${repo.repo}/blob/${sha}/${directory}/kustomization.yaml`
}
