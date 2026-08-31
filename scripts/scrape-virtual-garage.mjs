#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

import {
  DEFAULT_SOURCE_URL,
  assertSuccessfulPageResponse,
  downloadDatasetImages,
  extractVirtualGarageFromDocument,
  summarizeDataset,
} from '../src/virtual-garage.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaults = {
  chrome: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  images: path.join(repositoryRoot, 'assets', 'images', 'virtual-garage'),
  output: path.join(repositoryRoot, 'data', 'virtual-garage.json'),
  source: DEFAULT_SOURCE_URL,
};

function parseArguments(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !['--chrome', '--images', '--output', '--snapshot', '--source'].includes(flag)) {
      throw new Error(`Unknown or incomplete argument: ${flag}`);
    }
    options[flag.slice(2)] = value;
  }
  options.images = path.resolve(options.images);
  options.output = path.resolve(options.output);
  if (options.snapshot) options.snapshot = path.resolve(options.snapshot);
  return options;
}

async function scrapeLive(options) {
  const browser = await chromium.launch({ executablePath: options.chrome, headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => {
      const request = route.request();
      const blocked = ['font', 'image', 'media'].includes(request.resourceType())
        || /doubleclick|googlesyndication|amazon-adsystem|quantserve/.test(request.url());
      return blocked ? route.abort() : route.continue();
    });
    const response = await page.goto(options.source, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    assertSuccessfulPageResponse({ status: response?.status() || 0, title: await page.title() });
    await page.waitForSelector('.mw-parser-output table.wikitable', { timeout: 60_000 });
    return page.evaluate(extractVirtualGarageFromDocument, {
      sourceTitle: await page.title(),
      sourceUrl: options.source,
    });
  } finally {
    await browser.close();
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const dataset = options.snapshot
    ? JSON.parse(await readFile(options.snapshot, 'utf8'))
    : await scrapeLive(options);

  for (const table of dataset.tables) {
    table.type = table.headers[0] === 'Year'
      ? 'completion'
      : table.headers.some((header) => header.startsWith('Photo '))
        ? 'physical'
        : 'collectibles';
  }

  await downloadDatasetImages(dataset, {
    outputDirectory: options.images,
    repositoryRoot,
  });
  dataset.stats = summarizeDataset(dataset);
  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log(
    JSON.stringify({ dataFile: path.relative(repositoryRoot, options.output), ...dataset.stats }, null, 2),
  );
}

main().catch((error) => {
  console.error(`Scrape failed: ${error.message}`);
  process.exitCode = 1;
});
