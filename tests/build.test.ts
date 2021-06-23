import * as exec from '@actions/exec'
import * as io from '@actions/io'
import { kustomizeBuild } from '../src/build'

jest.mock('@actions/exec')
jest.mock('@actions/io')
const execMock = exec.exec as jest.Mock<Promise<number>>
const mkdirPMock = io.mkdirP as jest.Mock<Promise<void>>

test('single file', async () => {
  execMock.mockResolvedValue(0)
  await kustomizeBuild(
    [
      {
        kustomizationDir: '/fixtures/development',
        outputFile: '/output/development/generated.yaml',
      },
    ],
    3
  )
  expect(mkdirPMock).toHaveBeenCalledWith('/output/development')
  expect(execMock).toHaveBeenCalledTimes(1)
  expect(execMock.mock.calls[0][0]).toBe('kustomize')
  expect(execMock.mock.calls[0][1]).toStrictEqual([
    'build',
    '/fixtures/development',
    '-o',
    '/output/development/generated.yaml',
  ])
})

test('multiple files', async () => {
  execMock.mockResolvedValue(0)
  await kustomizeBuild(
    [
      {
        kustomizationDir: '/fixtures/development',
        outputFile: '/output/development/generated.yaml',
      },
      {
        kustomizationDir: '/fixtures/production',
        outputFile: '/output/production/generated.yaml',
      },
    ],
    3
  )

  expect(mkdirPMock).toHaveBeenCalledWith('/output/development')
  expect(mkdirPMock).toHaveBeenCalledWith('/output/production')

  expect(execMock).toHaveBeenCalledTimes(2)
  expect(execMock.mock.calls[0][0]).toBe('kustomize')
  expect(execMock.mock.calls[0][1]).toStrictEqual([
    'build',
    '/fixtures/development',
    '-o',
    '/output/development/generated.yaml',
  ])
  expect(execMock.mock.calls[1][0]).toBe('kustomize')
  expect(execMock.mock.calls[1][1]).toStrictEqual([
    'build',
    '/fixtures/production',
    '-o',
    '/output/production/generated.yaml',
  ])
})
