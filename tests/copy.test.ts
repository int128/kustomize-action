import { it, expect, vi } from 'vitest'
import * as io from '@actions/io'
import { copyExtraFiles } from '../src/copy.js'

vi.mock('@actions/io')
const mkdirPMock = vi.mocked(io).mkdirP
const cpMock = vi.mocked(io).cp

it('run successfully', async () => {
  mkdirPMock.mockResolvedValue()
  cpMock.mockResolvedValue()

  process.chdir(__dirname)
  await copyExtraFiles('fixtures/overlays/*/metadata.yaml', '/tmp/foo')

  expect(mkdirPMock).toHaveBeenCalledWith(`/tmp/foo/fixtures/overlays/development`)
  expect(cpMock).toHaveBeenCalledWith(
    `${__dirname}/fixtures/overlays/development/metadata.yaml`,
    `/tmp/foo/fixtures/overlays/development/metadata.yaml`,
  )
})
