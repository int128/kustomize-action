import { globKustomization, Kustomization } from '../src/glob'

test('run successfully', async () => {
  process.chdir(__dirname)
  const got = await globKustomization('fixtures/overlays/*/kustomization.yaml', '/tmp/foo')
  expect(got).toStrictEqual<Kustomization[]>([
    {
      kustomizationDir: `${__dirname}/fixtures/overlays/development`,
      outputFile: '/tmp/foo/fixtures/overlays/development/generated.yaml',
    },
    {
      kustomizationDir: `${__dirname}/fixtures/overlays/production`,
      outputFile: '/tmp/foo/fixtures/overlays/production/generated.yaml',
    },
  ])
})
