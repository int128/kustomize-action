import { Kustomization } from '../src/build.js'
import { globKustomization } from '../src/glob.js'

test('run successfully', async () => {
  process.chdir(__dirname)
  const got = await globKustomization('fixtures/overlays/*/kustomization.yaml', '/tmp/foo')
  expect(got).toStrictEqual<Kustomization[]>([
    {
      kustomizationDir: `${__dirname}/fixtures/overlays/development`,
      outputDir: '/tmp/foo/fixtures/overlays/development',
    },
    {
      kustomizationDir: `${__dirname}/fixtures/overlays/production`,
      outputDir: '/tmp/foo/fixtures/overlays/production',
    },
  ])
})
