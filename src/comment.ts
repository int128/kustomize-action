import * as github from '@actions/github'
import type { KustomizeError } from './build.js'

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
