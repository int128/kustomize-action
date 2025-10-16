import { expect, it } from 'vitest'
import type { Kustomization } from '../src/build.js'
import { globKustomization } from '../src/glob.js'

it('run successfully', async () => {
  process.chdir(__dirname)
  const got = await globKustomization('fixtures/overlays/*/kustomization.yaml', '/tmp/foo')
  expect(got).toStrictEqual<Kustomization[]>([
    {
      kustomizationDir: `fixtures/overlays/development`,
      outputDir: '/tmp/foo/fixtures/overlays/development',
    },
    {
      kustomizationDir: `fixtures/overlays/production`,
      outputDir: '/tmp/foo/fixtures/overlays/production',
    },
  ])
})
