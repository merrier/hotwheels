#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SOURCE_URL, extractVirtualGarageFromDocument } from '../src/virtual-garage.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(repositoryRoot, 'tools', 'export-virtual-garage.js');
const script = `// Paste this entire file into DevTools Console on the loaded Virtual Garage page.\n`
  + `(() => {\n`
  + `  const extract = ${extractVirtualGarageFromDocument.toString()};\n`
  + `  const dataset = extract({ sourceUrl: ${JSON.stringify(DEFAULT_SOURCE_URL)}, sourceTitle: document.title });\n`
  + `  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });\n`
  + `  const link = document.createElement('a');\n`
  + `  link.download = 'virtual-garage-extracted.json';\n`
  + `  link.href = URL.createObjectURL(blob);\n`
  + `  link.click();\n`
  + `  setTimeout(() => URL.revokeObjectURL(link.href), 1000);\n`
  + `  console.info('Exported', dataset.tables.length, 'tables');\n`
  + `})();\n`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, script);
console.log(path.relative(repositoryRoot, outputPath));
