/**
 * TypeScript to Swift Type Generator
 *
 * Generates Swift Codable structs from TypeScript interfaces for iOS app.
 * This ensures type safety between the web app and iOS app.
 *
 * Usage: npm run generate:swift
 */

import * as fs from 'fs';
import * as path from 'path';

// Type mappings from TypeScript to Swift
const TYPE_MAP: Record<string, string> = {
  string: 'String',
  number: 'Double',
  boolean: 'Bool',
  Date: 'Date',
  any: 'Any',
  unknown: 'Any',
};

interface SwiftProperty {
  name: string;
  type: string;
  isOptional: boolean;
  isArray: boolean;
}

/**
 * Convert TypeScript type to Swift type
 */
function convertType(tsType: string): { swiftType: string; isArray: boolean } {
  let isArray = false;
  let cleanType = tsType.trim();

  // Handle array types
  if (cleanType.endsWith('[]')) {
    isArray = true;
    cleanType = cleanType.slice(0, -2).trim();
  }

  // Handle Array<T> syntax
  const arrayMatch = cleanType.match(/Array<(.+)>/);
  if (arrayMatch) {
    isArray = true;
    cleanType = arrayMatch[1].trim();
  }

  // Map basic types
  const swiftType = TYPE_MAP[cleanType] || cleanType;

  return { swiftType, isArray };
}

/**
 * Parse TypeScript interface to Swift struct
 */
function parseInterface(interfaceName: string, content: string): string {
  const lines = content.split('\n');
  const properties: SwiftProperty[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      continue;
    }

    // Parse property: name?: type;
    const propertyMatch = trimmed.match(/^(\w+)(\?)?:\s*(.+?);?\s*$/);
    if (propertyMatch) {
      const [, name, optional, tsType] = propertyMatch;
      const { swiftType, isArray } = convertType(tsType);

      properties.push({
        name,
        type: swiftType,
        isOptional: optional === '?',
        isArray,
      });
    }
  }

  // Generate Swift struct
  let swiftCode = `\n// MARK: - ${interfaceName}\n`;
  swiftCode += `public struct ${interfaceName}: Codable, Sendable {\n`;

  for (const prop of properties) {
    const varType = prop.isArray ? `[${prop.type}]` : prop.type;
    const optionalMarker = prop.isOptional ? '?' : '';
    swiftCode += `    public var ${prop.name}: ${varType}${optionalMarker}\n`;
  }

  swiftCode += `}\n`;

  return swiftCode;
}

/**
 * Read all TypeScript model files and generate Swift
 */
function generateSwiftTypes() {
  const modelsDir = path.join(__dirname, '../src/models');
  const outputFile = path.join(__dirname, '../../../apps/ios/RunSmart/Generated/SharedModels.swift');

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let swiftOutput = `//
// SharedModels.swift
// RunSmart
//
// AUTO-GENERATED from TypeScript interfaces in packages/shared/src/models/
// DO NOT EDIT MANUALLY - changes will be overwritten
//
// Generated: ${new Date().toISOString()}
//

import Foundation

`;

  // Read all model files
  const modelFiles = fs.readdirSync(modelsDir).filter((f) => f.endsWith('.ts'));

  for (const file of modelFiles) {
    const filePath = path.join(modelsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract all interfaces from the file
    const interfaceRegex = /export interface (\w+) \{([^}]+)\}/gs;
    let match;

    while ((match = interfaceRegex.exec(content)) !== null) {
      const [, interfaceName, interfaceBody] = match;
      const swiftStruct = parseInterface(interfaceName, interfaceBody);
      swiftOutput += swiftStruct;
    }
  }

  // Add helper extensions
  swiftOutput += `
// MARK: - Helper Extensions

extension Date {
    /// ISO8601 date formatter for API communication
    static let iso8601Formatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

// MARK: - Custom Coding Keys

// Add custom CodingKeys here if needed for snake_case to camelCase conversion
`;

  fs.writeFileSync(outputFile, swiftOutput, 'utf-8');

  console.log(`✅ Generated Swift types: ${outputFile}`);
  console.log(`📝 Processed ${modelFiles.length} model files`);
  console.log(`📱 Ready for iOS app consumption`);
}

// Run the generator
try {
  generateSwiftTypes();
} catch (error) {
  console.error('❌ Error generating Swift types:', error);
  process.exit(1);
}
