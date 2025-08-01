// ABOUTME: This module handles redaction of sensitive data in Kubernetes Secrets
// ABOUTME: It processes YAML files and replaces Secret data values with [REDACTED]

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import { promises as fs } from 'fs'
import * as path from 'path'

const REDACTED_VALUE = '[REDACTED]'

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
  
  return redactedDocuments.join('---')
}

/**
 * Redacts sensitive data in a single YAML document
 */
const redactSecretInDocument = (document: string): string => {  
  // Check if this document contains a Kubernetes Secret
  if (!isSecretDocument(document)) {
    return document
  }
  
  // Redact data and stringData fields
  let redactedDoc = document
  
  // Redact data field
  redactedDoc = redactDataField(redactedDoc, 'data')
  
  // Redact stringData field  
  redactedDoc = redactDataField(redactedDoc, 'stringData')
  
  return redactedDoc
}

/**
 * Checks if a YAML document represents a Kubernetes Secret
 */
const isSecretDocument = (document: string): boolean => {
  return /^\s*kind:\s*Secret\s*$/m.test(document) && 
         /^\s*apiVersion:\s*v1\s*$/m.test(document)
}

/**
 * Redacts values in a specific data field (data or stringData)
 */
const redactDataField = (document: string, fieldName: string): string => {
  const lines = document.split('\n')
  const result: string[] = []
  let inDataField = false
  let dataFieldIndent = 0
  let skipMultilineValue = false
  let multilineKeyIndent = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Check if we're starting the target field
    if (new RegExp(`^\\s*${fieldName}:\\s*$`).test(line)) {
      inDataField = true
      dataFieldIndent = line.length - line.trimStart().length
      result.push(line)
      continue
    }
    
    // If we're in the data field
    if (inDataField) {
      const lineIndent = line.length - line.trimStart().length
      
      // If line has same or less indentation than field declaration, we're out of the field
      if (trimmed && lineIndent <= dataFieldIndent) {
        inDataField = false
        skipMultilineValue = false
        result.push(line)
        continue
      }
      
      // Skip empty lines within data field
      if (!trimmed) {
        if (!skipMultilineValue) {
          result.push(line)
        }
        continue
      }
      
      // If we're skipping multiline content, check if this line is still part of it
      if (skipMultilineValue && lineIndent > multilineKeyIndent) {
        // Skip lines that are part of a multiline value
        continue
      }
      
      // Check if this is a key-value pair (contains colon and is at the correct indentation level)
      if (trimmed.includes(':') && !skipMultilineValue) {
        const colonIndex = line.indexOf(':')
        const key = line.substring(0, colonIndex)
        const valueStart = line.substring(colonIndex + 1).trim()
        
        // Replace the value with [REDACTED]
        result.push(`${key}: ${REDACTED_VALUE}`)
        
        // Check if this is a multiline value (|, >, etc)
        if (valueStart.match(/^[|>-]/)) {
          skipMultilineValue = true
          multilineKeyIndent = lineIndent
        } else {
          skipMultilineValue = false
        }
      } else {
        // If we're not in a multiline value, this might be a regular line
        if (!skipMultilineValue) {
          result.push(line)
        }
        // If we are in a multiline value but the indentation suggests we're out of it
        else if (lineIndent <= multilineKeyIndent) {
          skipMultilineValue = false
          result.push(line)
        }
      }
    } else {
      // Not in data field, keep line as is
      result.push(line)
    }
  }
  
  return result.join('\n')
}