import { it, expect, vi, test } from 'vitest'
import * as exec from '@actions/exec'
import * as io from '@actions/io'
import { Kustomization, kustomizeBuild } from '../src/build.js'
import { RetryOptions } from '../src/kustomize.js'

vi.mock('@actions/core') // suppress logs

vi.mock('@actions/exec')
vi.mock('@actions/io')
const execMock = vi.mocked(exec).getExecOutput
const mkdirPMock = vi.mocked(io).mkdirP

const noRetry: RetryOptions = {
  retryMaxAttempts: 0,
  retryWaitMs: 0,
}

it('nothing', async () => {
  const results = await kustomizeBuild([], {
    kustomizeBuildArgs: [],
    maxProcess: 1,
    writeIndividualFiles: false,
    ...noRetry,
  })
  expect(results).toStrictEqual([])
  expect(mkdirPMock).not.toHaveBeenCalled()
  expect(execMock).not.toHaveBeenCalled()
})

it('build a directory', async () => {
  execMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
  const results = await kustomizeBuild(
    [
      {
        kustomizationDir: '/fixtures/development',
        outputDir: '/output/development',
      },
    ],
    {
      kustomizeBuildArgs: [],
      maxProcess: 3,
      writeIndividualFiles: false,
      ...noRetry,
    },
  )
  expect(results).toStrictEqual([
    {
      kustomization: {
        kustomizationDir: '/fixtures/development',
        outputDir: '/output/development',
      },
      success: true,
    },
  ])
  expect(mkdirPMock).toHaveBeenCalledExactlyOnceWith('/output/development')
  expect(execMock).toHaveBeenCalledTimes(1)
  expect(execMock.mock.calls[0][0]).toBe('kustomize')
  expect(execMock.mock.calls[0][1]).toStrictEqual([
    'build',
    '/fixtures/development',
    '-o',
    '/output/development/generated.yaml',
  ])
})

it('build a directory to individual files', async () => {
  execMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })
  const results = await kustomizeBuild(
    [
      {
        kustomizationDir: '/fixtures/development',
        outputDir: '/output/development',
      },
    ],
    {
      kustomizeBuildArgs: [],
      maxProcess: 3,
      writeIndividualFiles: true,
      ...noRetry,
    },
  )
  expect(results).toStrictEqual([
    {
      kustomization: {
        kustomizationDir: '/fixtures/development',
        outputDir: '/output/development',
      },
      success: true,
    },
  ])
  expect(mkdirPMock).toHaveBeenCalledExactlyOnceWith('/output/development')
  expect(execMock).toHaveBeenCalledTimes(1)
  expect(execMock.mock.calls[0][0]).toBe('kustomize')
  expect(execMock.mock.calls[0][1]).toStrictEqual(['build', '/fixtures/development', '-o', '/output/development'])
})

it('build a directory with an error', async () => {
  execMock.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'error' })
  const results = await kustomizeBuild(
    [
      {
        kustomizationDir: '/fixtures/development',
        outputDir: '/output/development',
      },
    ],
    {
      kustomizeBuildArgs: [],
      maxProcess: 3,
      writeIndividualFiles: false,
      ...noRetry,
    },
  )
  expect(results).toHaveLength(1)
  expect(results[0].success).toBe(false)
  expect(mkdirPMock).toHaveBeenCalledExactlyOnceWith('/output/development')
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
`(
  'build $overlays directories using $maxProcess process',
  async ({ overlays, maxProcess }: { overlays: number; maxProcess: number }) => {
    execMock.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    const kustomizations: Kustomization[] = []
    for (let i = 0; i < overlays; i++) {
      kustomizations.push({
        kustomizationDir: `/input/fixture${i}`,
        outputDir: `/output/fixture${i}`,
      })
    }
    const results = await kustomizeBuild(kustomizations, {
      kustomizeBuildArgs: [],
      maxProcess,
      writeIndividualFiles: false,
      ...noRetry,
    })

    expect(results).toHaveLength(overlays)
    expect(results.every((result) => result.success)).toBe(true)

    expect(execMock).toHaveBeenCalledTimes(overlays)
    for (let i = 0; i < overlays; i++) {
      expect(mkdirPMock).toHaveBeenCalledExactlyOnceWith(`/output/fixture${i}`)
      expect(execMock.mock.calls[i][0]).toBe('kustomize')
      expect(execMock.mock.calls[i][1]).toStrictEqual([
        'build',
        `/input/fixture${i}`,
        '-o',
        `/output/fixture${i}/generated.yaml`,
      ])
    }
  },
)

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
  async ({ overlays, maxProcess, exitCodes }: { overlays: number; maxProcess: number; exitCodes: number[] }) => {
    for (const exitCode of exitCodes) {
      execMock.mockResolvedValueOnce({ exitCode, stdout: '', stderr: '' })
    }

    const kustomizations: Kustomization[] = []
    for (let i = 0; i < overlays; i++) {
      kustomizations.push({
        kustomizationDir: `/input/fixture${i}`,
        outputDir: `/output/fixture${i}`,
      })
    }
    const results = await kustomizeBuild(kustomizations, {
      kustomizeBuildArgs: [],
      maxProcess,
      writeIndividualFiles: false,
      ...noRetry,
    })

    expect(results).toHaveLength(overlays)
    expect(results.filter((result) => !result.success)).toHaveLength(1)

    expect(execMock).toHaveBeenCalledTimes(overlays)
    for (let i = 0; i < overlays; i++) {
      expect(mkdirPMock).toHaveBeenCalledExactlyOnceWith(`/output/fixture${i}`)
      expect(execMock.mock.calls[i][0]).toBe('kustomize')
      expect(execMock.mock.calls[i][1]).toStrictEqual([
        'build',
        `/input/fixture${i}`,
        '-o',
        `/output/fixture${i}/generated.yaml`,
      ])
    }
  },
)
