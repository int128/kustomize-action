import * as core from '@actions/core'
import * as github from '@actions/github'
import * as path from 'path'
import { KustomizeError } from './build.js'

type Octokit = ReturnType<typeof github.getOctokit>

type CommentOptions = {
  header: string
  footer: string
}

export const commentErrors = async (octokit: Octokit, errors: KustomizeError[], o: CommentOptions): Promise<void> => {
  if (github.context.payload.pull_request === undefined) {
    return
  }

  const body = [o.header, errors.map(errorTemplate).join('\n'), o.footer].join('\n')

  const { data } = await octokit.rest.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.payload.pull_request.number,
    body,
  })
  core.info(`created a comment as ${data.html_url}`)
}

export const summaryErrors = async (errors: KustomizeError[]) => {
  core.summary.addRaw(`kustomize build finished with ${errors.length} error(s)`)
  core.summary.addRaw(errors.map(errorTemplate).join('\n'))
  await core.summary.write()
}

const errorTemplate = (e: KustomizeError): string => {
  const relativeDir = path.relative('.', e.kustomization.kustomizationDir)
  return `
### ${relativeDir}
[kustomization.yaml](${kustomizationUrl(relativeDir)}) is invalid:
<blockquote>${e.stderr.trim()}</blockquote>
`
}

const kustomizationUrl = (directory: string) => {
  const { serverUrl, repo, sha } = github.context
  return `${serverUrl}/${repo.owner}/${repo.repo}/blob/${sha}/${directory}/kustomization.yaml`
}
