import * as exec from '@actions/exec'
import * as io from '@actions/io'
import { Kustomization, kustomizeBuild } from '../src/build'

jest.mock('@actions/core') // suppress logs

jest.mock('@actions/exec')
jest.mock('@actions/io')
const execMock = exec.exec as jest.Mock<Promise<number>>
const mkdirPMock = io.mkdirP as jest.Mock<Promise<void>>

test('nothing', async () => {
  await kustomizeBuild([], 1)
  expect(mkdirPMock).not.toHaveBeenCalled()
  expect(execMock).not.toHaveBeenCalled()
})

test('build a directory', async () => {
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

test('build a directory with an error', async () => {
  execMock.mockResolvedValue(1)
  await expect(
    kustomizeBuild(
      [
        {
          kustomizationDir: '/fixtures/development',
          outputFile: '/output/development/generated.yaml',
        },
      ],
      3
    )
  ).rejects.toThrowError()
  expect(mkdirPMock).toHaveBeenCalledWith('/output/development')
  expect(execMock).toHaveBeenCalledTimes(1)
})

test.each`
  overlays | maxProcess
  ${1}     | ${1}
  ${1}     | ${2}
  ${2}     | ${1}
  ${2}     | ${2}
  ${2}     | ${3}
  ${3}     | ${1}
  ${3}     | ${2}
  ${3}     | ${3}
  ${3}     | ${4}
`('build $overlays directories using $maxProcess process', async ({ overlays, maxProcess }) => {
  execMock.mockResolvedValue(0)

  const kustomizations: Kustomization[] = []
  for (let i = 0; i < overlays; i++) {
    kustomizations.push({
      kustomizationDir: `/input/fixture${i}`,
      outputFile: `/output/fixture${i}/generated.yaml`,
    })
  }
  await kustomizeBuild(kustomizations, maxProcess)

  expect(execMock).toHaveBeenCalledTimes(overlays)
  for (let i = 0; i < overlays; i++) {
    expect(mkdirPMock).toHaveBeenCalledWith(`/output/fixture${i}`)
    expect(execMock.mock.calls[i][0]).toBe('kustomize')
    expect(execMock.mock.calls[i][1]).toStrictEqual([
      'build',
      `/input/fixture${i}`,
      '-o',
      `/output/fixture${i}/generated.yaml`,
    ])
  }
})

test.each`
  overlays | maxProcess | exitCodes
  ${3}     | ${2}       | ${[1, 0, 0]}
  ${3}     | ${2}       | ${[0, 1, 0]}
  ${3}     | ${2}       | ${[0, 0, 1]}
  ${4}     | ${2}       | ${[1, 0, 0, 0]}
  ${4}     | ${2}       | ${[0, 1, 0, 0]}
  ${4}     | ${2}       | ${[0, 0, 1, 0]}
  ${4}     | ${2}       | ${[0, 0, 0, 1]}
`(
  'build $overlays directories using $maxProcess process with error $exitCodes',
  async ({ overlays, maxProcess, exitCodes }) => {
    for (const exitCode of exitCodes) {
      execMock.mockResolvedValueOnce(exitCode)
    }

    const kustomizations: Kustomization[] = []
    for (let i = 0; i < overlays; i++) {
      kustomizations.push({
        kustomizationDir: `/input/fixture${i}`,
        outputFile: `/output/fixture${i}/generated.yaml`,
      })
    }
    await expect(kustomizeBuild(kustomizations, maxProcess)).rejects.toThrowError()

    expect(execMock).toHaveBeenCalledTimes(overlays)
    for (let i = 0; i < overlays; i++) {
      expect(mkdirPMock).toHaveBeenCalledWith(`/output/fixture${i}`)
      expect(execMock.mock.calls[i][0]).toBe('kustomize')
      expect(execMock.mock.calls[i][1]).toStrictEqual([
        'build',
        `/input/fixture${i}`,
        '-o',
        `/output/fixture${i}/generated.yaml`,
      ])
    }
  }
)
