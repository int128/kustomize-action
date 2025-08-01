import { it, expect, vi, describe, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { redactSecretsInYaml, redactSecretsInFile, redactSecretsInDirectory } from '../src/redact.js'

vi.mock('@actions/core') // suppress logs

describe('redactSecretsInYaml', () => {
  it('should redact data fields with content-based hash', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  username: YWRtaW4=
  password: MWYyZDFlMmU2N2Rm`

    const result = redactSecretsInYaml(yamlContent)
    
    // Check that values are redacted with hash format
    expect(result).toMatch(/username: \[REDACTED-[a-f0-9]{8}\]/)
    expect(result).toMatch(/password: \[REDACTED-[a-f0-9]{8}\]/)
    
    // Verify metadata is preserved
    expect(result).toContain('name: my-secret')
  })

  it('should redact stringData fields', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
stringData:
  config: |
    secret: confidential`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toMatch(/config: \[REDACTED-[a-f0-9]{8}\]/)
    expect(result).not.toContain('confidential')
  })

  it('should not modify non-Secret resources', () => {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(yamlContent)
  })

  it('should handle multi-document YAML', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
data:
  password: c2VjcmV0
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toMatch(/password: \[REDACTED-[a-f0-9]{8}\]/)
    expect(result).toContain('kind: Deployment')
  })

  it('should handle Secret without data fields', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: empty-secret`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(yamlContent)
  })

  it('should produce consistent hashes for same content', () => {
    const yaml1 = `apiVersion: v1
kind: Secret
data:
  key: same-value`

    const yaml2 = `apiVersion: v1
kind: Secret
data:
  key: same-value`

    const result1 = redactSecretsInYaml(yaml1)
    const result2 = redactSecretsInYaml(yaml2)
    
    const hash1 = result1.match(/\[REDACTED-([a-f0-9]{8})\]/)![1]
    const hash2 = result2.match(/\[REDACTED-([a-f0-9]{8})\]/)![1]
    
    expect(hash1).toBe(hash2) // Same content = same hash
  })

  it('should produce different hashes for different content', () => {
    const yaml1 = `apiVersion: v1
kind: Secret
data:
  key: value1`

    const yaml2 = `apiVersion: v1
kind: Secret
data:
  key: value2`

    const result1 = redactSecretsInYaml(yaml1)
    const result2 = redactSecretsInYaml(yaml2)
    
    const hash1 = result1.match(/\[REDACTED-([a-f0-9]{8})\]/)![1]
    const hash2 = result2.match(/\[REDACTED-([a-f0-9]{8})\]/)![1]
    
    expect(hash1).not.toBe(hash2) // Different content = different hash
  })

  it('should handle data field with comments', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: test-secret
data: # This is a comment
  sso-issuer: aHR0cHM6Ly9leGFtcGxlLmNvbQ==`

    const result = redactSecretsInYaml(yamlContent)
    // Should not redact because regex doesn't match data field with comment
    expect(result).toContain('aHR0cHM6Ly9leGFtcGxlLmNvbQ==')
  })

  it('should handle incorrect indentation', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: test-secret
data:
sso-issuer: aHR0cHM6Ly9leGFtcGxlLmNvbQ==`

    const result = redactSecretsInYaml(yamlContent)
    // Should not redact because incorrect indentation
    expect(result).toContain('aHR0cHM6Ly9leGFtcGxlLmNvbQ==')
  })

  it('should not redact non-v1 Secrets', () => {
    const yamlContent = `apiVersion: v2
kind: Secret
metadata:
  name: test-secret
data:
  sso-issuer: aHR0cHM6Ly9leGFtcGxlLmNvbQ==`

    const result = redactSecretsInYaml(yamlContent)
    // Should not redact because apiVersion is not v1
    expect(result).toBe(yamlContent)
  })

  it('should handle multiline values followed by regular values', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: test-secret
data:
  config: |
    server:
      host: example.com
      port: 443
  sso-issuer: aHR0cHM6Ly9leGFtcGxlLmNvbQ==`

    const result = redactSecretsInYaml(yamlContent)
    // Both values should be redacted
    expect(result).toMatch(/config: \[REDACTED-[a-f0-9]{8}\]/)
    expect(result).toMatch(/sso-issuer: \[REDACTED-[a-f0-9]{8}\]/)
    expect(result).not.toContain('aHR0cHM6Ly9leGFtcGxlLmNvbQ==')
  })
})

describe('file operations', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'redact-test-'))
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  it('should redact secrets in a file', async () => {
    const yamlContent = `apiVersion: v1
kind: Secret
data:
  password: c2VjcmV0`

    const filePath = path.join(tempDir, 'secret.yaml')
    await fs.writeFile(filePath, yamlContent, 'utf8')

    await redactSecretsInFile(filePath)

    const result = await fs.readFile(filePath, 'utf8')
    expect(result).toMatch(/password: \[REDACTED-[a-f0-9]{8}\]/)
  })

  it('should not modify non-secret files', async () => {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment`

    const filePath = path.join(tempDir, 'deployment.yaml')
    await fs.writeFile(filePath, yamlContent, 'utf8')

    await redactSecretsInFile(filePath)

    const result = await fs.readFile(filePath, 'utf8')
    expect(result).toBe(yamlContent)
  })

  it('should redact secrets in directory', async () => {
    const secretYaml = `apiVersion: v1
kind: Secret
data:
  key: dmFsdWU=`

    await fs.writeFile(path.join(tempDir, 'secret.yaml'), secretYaml, 'utf8')

    await redactSecretsInDirectory(tempDir)

    const result = await fs.readFile(path.join(tempDir, 'secret.yaml'), 'utf8')
    expect(result).toMatch(/key: \[REDACTED-[a-f0-9]{8}\]/)
  })

  it('should handle file errors gracefully', async () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.yaml')
    const result = await redactSecretsInFile(nonExistentFile)
    expect(result).toBe(false)
  })
})