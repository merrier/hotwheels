#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { summarizeDataset } from '../src/virtual-garage.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(repositoryRoot, 'data', 'virtual-garage.json');
const dataset = JSON.parse(await readFile(dataPath, 'utf8'));
const summary = summarizeDataset(dataset);

if (JSON.stringify(summary) !== JSON.stringify(dataset.stats)) {
  throw new Error(`Dataset stats mismatch: ${JSON.stringify({ actual: summary, stored: dataset.stats })}`);
}

const images = dataset.tables.flatMap((table) =>
  table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.images || [])),
);
for (const image of images) {
  const filePath = path.resolve(repositoryRoot, image.localPath);
  if (!filePath.startsWith(`${repositoryRoot}${path.sep}`)) throw new Error(`Unsafe path: ${image.localPath}`);
  const bytes = await readFile(filePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== image.byteSize || sha256 !== image.sha256) {
    throw new Error(`Image verification failed: ${image.localPath}`);
  }
}

console.log(JSON.stringify({ dataFile: path.relative(repositoryRoot, dataPath), ...summary }, null, 2));
