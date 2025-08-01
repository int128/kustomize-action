// ABOUTME: This module handles redaction of sensitive data in Kubernetes Secrets
// ABOUTME: It processes YAML files and replaces Secret data values with [REDACTED]

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import { promises as fs } from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as yaml from 'js-yaml'

/**
 * Generate a redacted value based on the original content
 * This allows diff tools to detect changes while keeping content secure
 */
const getRedactedValue = (originalValue: string): string => {
  const hash = crypto.createHash('sha256').update(originalValue.trim()).digest('hex').substring(0, 8)
  return `[REDACTED-${hash}]`
}

/**
 * Redacts sensitive data in all YAML files within the specified directory
 */
export const redactSecretsInDirectory = async (outputDir: string): Promise<void> => {
  const yamlGlobber = await glob.create(path.join(outputDir, '**/*.yaml'), { matchDirectories: false })
  const yamlFiles = await yamlGlobber.glob()

  let redactedCount = 0
  for (const yamlFile of yamlFiles) {
    const wasRedacted = await redactSecretsInFile(yamlFile)
    if (wasRedacted) redactedCount++
  }
  
  if (redactedCount > 0) {
    core.info(`Successfully redacted secrets in ${redactedCount} file(s)`)
  }
}

/**
 * Redacts sensitive data in a single YAML file
 * @returns true if redaction was performed, false otherwise
 */
export const redactSecretsInFile = async (filePath: string): Promise<boolean> => {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const redactedContent = redactSecretsInYaml(content)
    
    if (content !== redactedContent) {
      await fs.writeFile(filePath, redactedContent, 'utf8')
      return true
    }
    return false
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    core.warning(`Failed to redact secrets: ${message}`)
    return false
  }
}

/**
 * Redacts sensitive data in YAML content
 */
export const redactSecretsInYaml = (yamlContent: string): string => {
  // Split YAML by document separator
  const documents = yamlContent.split(/^---$/m)
  
  const redactedDocuments = documents.map(doc => {
    if (!doc.trim()) return doc
    
    try {
      return redactSecretInDocument(doc)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      core.debug(`Skipping document that couldn't be processed: ${message}`)
      return doc
    }
  })
  
  return redactedDocuments.join('\n---\n')
}

/**
 * Redacts sensitive data in a single YAML document
 */
const redactSecretInDocument = (document: string): string => {  
  // Check if this document contains a Kubernetes Secret
  if (!isSecretDocument(document)) {
    return document
  }
  
  try {
    const parsed = yaml.load(document) as Record<string, unknown>
    
    // Redact data field
    if (parsed.data && typeof parsed.data === 'object' && parsed.data !== null) {
      const dataObj = parsed.data as Record<string, string>
      for (const key in dataObj) {
        if (typeof dataObj[key] === 'string') {
          dataObj[key] = getRedactedValue(dataObj[key])
        }
      }
    }
    
    // Redact stringData field
    if (parsed.stringData && typeof parsed.stringData === 'object' && parsed.stringData !== null) {
      const stringDataObj = parsed.stringData as Record<string, string>
      for (const key in stringDataObj) {
        if (typeof stringDataObj[key] === 'string') {
          stringDataObj[key] = getRedactedValue(stringDataObj[key])
        }
      }
    }
    
    let result = yaml.dump(parsed, { 
      indent: 2, 
      lineWidth: -1, 
      forceQuotes: false,
      flowLevel: -1
    }).trimEnd()
    
    // Remove quotes around redacted values to match expected format
    result = result.replace(/["'](\[REDACTED-[a-f0-9]{8}\])["']/g, '$1')
    
    return result
  } catch (error) {
    // If YAML parsing fails, fall back to original document
    const message = error instanceof Error ? error.message : String(error)
    core.debug(`Failed to parse YAML document: ${message}`)
    return document
  }
}

/**
 * Checks if a YAML document represents a Kubernetes Secret
 */
const isSecretDocument = (document: string): boolean => {
  return /^\s*kind:\s*Secret\s*$/m.test(document) && 
         /^\s*apiVersion:\s*v1\s*$/m.test(document)
}

