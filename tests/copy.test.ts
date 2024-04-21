import * as io from '@actions/io'
import { copyExtraFiles } from '../src/copy.js'

jest.mock('@actions/io')
const mkdirPMock = io.mkdirP as jest.Mock<Promise<void>>
const cpMock = io.cp as jest.Mock<Promise<void>>

test('run successfully', async () => {
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
