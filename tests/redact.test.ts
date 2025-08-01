import { it, expect, vi, describe, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as os from 'os'
import { redactSecretsInYaml, redactSecretsInFile, redactSecretsInDirectory } from '../src/redact.js'

vi.mock('@actions/core') // suppress logs

describe('redactSecretsInYaml', () => {
  it('should redact data fields in Kubernetes Secret', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
data:
  username: YWRtaW4=
  password: MWYyZDFlMmU2N2Rm
  api-key: c29tZS1hcGkta2V5`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
  namespace: default
data:
  username: [REDACTED]
  password: [REDACTED]
  api-key: [REDACTED]`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(expected)
  })

  it('should redact stringData fields in Kubernetes Secret', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
stringData:
  username: admin
  password: secret123
  config.yaml: |
    key: value
    secret: confidential`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
stringData:
  username: [REDACTED]
  password: [REDACTED]
  config.yaml: [REDACTED]`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(expected)
  })

  it('should redact both data and stringData fields', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  encoded: YWRtaW4=
stringData:
  plain: admin`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  encoded: [REDACTED]
stringData:
  plain: [REDACTED]`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(expected)
  })

  it('should not modify non-Secret resources', () => {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: app
        image: nginx:latest
        env:
        - name: SECRET_KEY
          value: should-not-be-redacted`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(yamlContent)
  })

  it('should handle multi-document YAML', () => {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
---
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  password: c2VjcmV0
---
apiVersion: v1
kind: Service
metadata:
  name: my-service`

    const expected = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
---
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  password: [REDACTED]
---
apiVersion: v1
kind: Service
metadata:
  name: my-service`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(expected)
  })

  it('should handle Secret without data fields', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: empty-secret
type: Opaque`

    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(yamlContent)
  })

  it('should handle malformed YAML gracefully', () => {
    const yamlContent = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  invalid yaml: [unclosed bracket`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: my-secret
data:
  invalid yaml: [REDACTED]`

    // Should not throw and still redact what it can process
    const result = redactSecretsInYaml(yamlContent)
    expect(result).toBe(expected)
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
metadata:
  name: test-secret
data:
  password: c2VjcmV0`

    const filePath = path.join(tempDir, 'secret.yaml')
    await fs.writeFile(filePath, yamlContent, 'utf8')

    await redactSecretsInFile(filePath)

    const result = await fs.readFile(filePath, 'utf8')
    expect(result).toContain('password: [REDACTED]')
  })

  it('should not modify non-secret files', async () => {
    const yamlContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-app`

    const filePath = path.join(tempDir, 'deployment.yaml')
    await fs.writeFile(filePath, yamlContent, 'utf8')

    await redactSecretsInFile(filePath)

    const result = await fs.readFile(filePath, 'utf8')
    expect(result).toBe(yamlContent)
  })

  it('should redact secrets in all files in directory', async () => {
    // Create multiple files with secrets
    const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: secret1
data:
  key: dmFsdWU=`

    const deploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: app`

    const secret2Yaml = `apiVersion: v1
kind: Secret
metadata:
  name: secret2
stringData:
  config: sensitive-data`

    await fs.writeFile(path.join(tempDir, 'secret1.yaml'), secretYaml, 'utf8')
    await fs.writeFile(path.join(tempDir, 'deployment.yaml'), deploymentYaml, 'utf8')
    await fs.writeFile(path.join(tempDir, 'secret2.yaml'), secret2Yaml, 'utf8')

    await redactSecretsInDirectory(tempDir)

    // Check that secrets were redacted
    const secret1Result = await fs.readFile(path.join(tempDir, 'secret1.yaml'), 'utf8')
    expect(secret1Result).toContain('key: [REDACTED]')

    const secret2Result = await fs.readFile(path.join(tempDir, 'secret2.yaml'), 'utf8')
    expect(secret2Result).toContain('config: [REDACTED]')

    // Check that deployment was not modified
    const deploymentResult = await fs.readFile(path.join(tempDir, 'deployment.yaml'), 'utf8')
    expect(deploymentResult).toBe(deploymentYaml)
  })

  it('should handle nested directories', async () => {
    const nestedDir = path.join(tempDir, 'nested')
    await fs.mkdir(nestedDir)

    const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: nested-secret
data:
  token: dG9rZW4=`

    await fs.writeFile(path.join(nestedDir, 'secret.yaml'), secretYaml, 'utf8')

    await redactSecretsInDirectory(tempDir)

    const result = await fs.readFile(path.join(nestedDir, 'secret.yaml'), 'utf8')
    expect(result).toContain('token: [REDACTED]')
  })

  it('should handle file read errors gracefully', async () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.yaml')
    
    // Should not throw error and return false
    const result = await redactSecretsInFile(nonExistentFile)
    expect(result).toBe(false)
  })

  it('should handle file write permission errors gracefully', async () => {
    const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: test-secret
data:
  key: value`

    const filePath = path.join(tempDir, 'readonly-secret.yaml')
    await fs.writeFile(filePath, secretYaml, 'utf8')
    
    // Make file read-only
    await fs.chmod(filePath, 0o444)

    // Should handle the error gracefully and return false
    const result = await redactSecretsInFile(filePath)
    expect(result).toBe(false)
    
    // Restore permissions for cleanup
    await fs.chmod(filePath, 0o644)
  })
})

describe('additional edge cases', () => {
  it('should handle different Secret types', () => {
    const tlsSecretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: LS0tLS1CRUdJTi...
  tls.key: LS0tLS1CRUdJTi...`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: [REDACTED]
  tls.key: [REDACTED]`

    const result = redactSecretsInYaml(tlsSecretYaml)
    expect(result).toBe(expected)
  })

  it('should handle docker config Secret type', () => {
    const dockerSecretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: docker-secret
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: eyJhdXRocyI6e319`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: docker-secret
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: [REDACTED]`

    const result = redactSecretsInYaml(dockerSecretYaml)
    expect(result).toBe(expected)
  })

  it('should handle empty data and stringData fields', () => {
    const emptySecretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: empty-secret
data: {}
stringData: {}`

    const result = redactSecretsInYaml(emptySecretYaml)
    expect(result).toBe(emptySecretYaml) // Should not change anything
  })

  it('should handle keys with special characters', () => {
    const specialKeySecretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: special-keys
data:
  my-key.with-dots: dmFsdWU=
  key_with_underscores: dmFsdWU=
  "key with spaces": dmFsdWU=
  key@with@symbols: dmFsdWU=`

    const expected = `apiVersion: v1
kind: Secret
metadata:
  name: special-keys
data:
  my-key.with-dots: [REDACTED]
  key_with_underscores: [REDACTED]
  "key with spaces": [REDACTED]
  key@with@symbols: [REDACTED]`

    const result = redactSecretsInYaml(specialKeySecretYaml)
    expect(result).toBe(expected)
  })

  it('should preserve YAML comments', () => {
    const commentedSecretYaml = `# This is a secret for authentication
apiVersion: v1
kind: Secret
metadata:
  name: commented-secret
  # This contains sensitive data
data:
  # Base64 encoded username
  username: YWRtaW4=
  # Base64 encoded password  
  password: cGFzcw==`

    const result = redactSecretsInYaml(commentedSecretYaml)
    
    // Should preserve comments
    expect(result).toContain('# This is a secret for authentication')
    expect(result).toContain('# This contains sensitive data')
    expect(result).toContain('# Base64 encoded username')
    expect(result).toContain('# Base64 encoded password')
    
    // Should redact values
    expect(result).toContain('username: [REDACTED]')
    expect(result).toContain('password: [REDACTED]')
  })

  it('should handle multiple Secrets in same document', () => {
    const multipleSecretsYaml = `apiVersion: v1
kind: Secret
metadata:
  name: secret1
data:
  key1: dmFsdWUx
---
apiVersion: v1
kind: Secret  
metadata:
  name: secret2
stringData:
  key2: value2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app`

    const result = redactSecretsInYaml(multipleSecretsYaml)
    
    expect(result).toContain('key1: [REDACTED]')
    expect(result).toContain('key2: [REDACTED]')
    expect(result).toContain('kind: Deployment') // Should preserve non-Secret
  })

  it('should handle incorrect Secret identification', () => {
    // Missing apiVersion
    const missingApiVersionYaml = `kind: Secret
metadata:
  name: invalid-secret
data:
  key: value`

    const result1 = redactSecretsInYaml(missingApiVersionYaml)
    expect(result1).toBe(missingApiVersionYaml) // Should not redact

    // Wrong apiVersion
    const wrongApiVersionYaml = `apiVersion: apps/v1
kind: Secret
metadata:
  name: invalid-secret
data:
  key: value`

    const result2 = redactSecretsInYaml(wrongApiVersionYaml)
    expect(result2).toBe(wrongApiVersionYaml) // Should not redact
  })
})