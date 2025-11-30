import type { KustomizeError } from './build.js'
import type { Context } from './github.js'

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
