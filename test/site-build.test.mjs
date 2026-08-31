import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildSite } from '../scripts/build-site.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');

test('builds a self-contained GitHub Pages artifact', async () => {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'hotwheels-site-'));

  try {
    const summary = await buildSite({ outputDirectory, repositoryRoot });
    const html = await readFile(path.join(outputDirectory, 'index.html'), 'utf8');

    assert.match(html, /\.\/styles\.css/);
    assert.match(html, /\.\/app\.js/);
    assert.equal(summary.imageCount, 98);
    assert.equal(summary.rowCount, 702);
    await access(path.join(outputDirectory, '.nojekyll'));
    await access(path.join(outputDirectory, 'data', 'virtual-garage.json'));
    await access(path.join(outputDirectory, 'assets', 'images', 'virtual-garage'));
  } finally {
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
