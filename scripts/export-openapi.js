#!/usr/bin/env node
/**
 * Export OpenAPI spec to client milestone 4 submission package.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

const swaggerSpec = require('../src/config/swagger');
const outDir = path.join(__dirname, '../../client documents/milestone 4 submission');
const jsonPath = path.join(outDir, 'openapi.json');
const yamlPath = path.join(outDir, 'openapi.yaml');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(swaggerSpec, null, 2)}\n`);
fs.writeFileSync(yamlPath, yaml.stringify(swaggerSpec));
console.log(`Exported ${jsonPath}`);
console.log(`Exported ${yamlPath}`);
