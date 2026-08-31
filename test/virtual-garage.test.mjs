import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

import {
  assertSuccessfulPageResponse,
  downloadDatasetImages,
  extractVirtualGarageFromDocument,
  normalizeOriginalImageUrl,
  summarizeDataset,
} from '../src/virtual-garage.mjs';

const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('extracts table hierarchy, text, links, and lazy-loaded images', async () => {
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage();

  try {
    await page.setContent(`
      <base href="https://hotwheels.fandom.com/wiki/Virtual_Garage">
      <div class="mw-parser-output">
        <h2><span id="Main_Series">Main Series</span></h2>
        <h3><span id="Series_1">Series 1</span><span class="mw-editsection">[]</span></h3>
        <div class="table-wide"><div class="table-wide-inner">
          <table class="wikitable">
            <tr><th>Card ID</th><th>Rarity</th><th>Casting Name</th><th>Toy #</th><th>Photo Loose</th></tr>
            <tr>
              <td>#01</td><td>NFTH</td>
              <td><a href="/wiki/Bone_Shaker">Bone Shaker</a></td><td>HLP65</td>
              <td><a href="https://static.wikia.nocookie.net/hotwheels/images/0/09/NFT_Bone_Shaker.jpg/revision/latest?cb=1"><img alt="NFT Bone Shaker" data-src="https://static.wikia.nocookie.net/hotwheels/images/0/09/NFT_Bone_Shaker.jpg/revision/latest/scale-to-width-down/100?cb=1"></a></td>
            </tr>
          </table>
        </div></div>
        <h4><span id="All_collectibles">All collectibles</span></h4>
        <div class="table-wide"><div class="table-wide-inner">
          <table class="wikitable">
            <tr><th>Card ID</th><th>Rarity</th><th>Casting Name</th><th>Segment</th></tr>
            <tr><td>#01</td><td>NFTH</td><td>Bone Shaker</td><td>Garage of Legends</td></tr>
          </table>
        </div></div>
      </div>
    `);

    const dataset = await page.evaluate(extractVirtualGarageFromDocument, {
      sourceTitle: 'Virtual Garage | Hot Wheels Wiki | Fandom',
      sourceUrl: 'https://hotwheels.fandom.com/wiki/Virtual_Garage',
    });

    assert.equal(dataset.tables.length, 2);
    assert.deepEqual(dataset.tables[0].headers, [
      'Card ID',
      'Rarity',
      'Casting Name',
      'Toy #',
      'Photo Loose',
    ]);
    assert.equal(dataset.tables[0].section, 'Main Series');
    assert.equal(dataset.tables[0].subsection, 'Series 1');
    assert.equal(dataset.tables[0].title, 'Series 1');
    assert.equal(dataset.tables[0].rows[0].values['Casting Name'], 'Bone Shaker');
    assert.equal(
      dataset.tables[0].rows[0].cells[2].links[0].href,
      'https://hotwheels.fandom.com/wiki/Bone_Shaker',
    );
    assert.equal(
      dataset.tables[0].rows[0].cells[4].images[0].sourceUrl,
      'https://static.wikia.nocookie.net/hotwheels/images/0/09/NFT_Bone_Shaker.jpg/revision/latest?cb=1',
    );
    assert.equal(dataset.tables[1].title, 'All collectibles');
    assert.deepEqual(summarizeDataset(dataset), {
      tableCount: 2,
      rowCount: 2,
      imageReferenceCount: 1,
      uniqueImageCount: 1,
      nfthPhysicalCount: 1,
    });
  } finally {
    await browser.close();
  }
});

test('normalizes a Fandom thumbnail URL to the original revision URL', () => {
  assert.equal(
    normalizeOriginalImageUrl(
      'https://static.wikia.nocookie.net/hotwheels/images/0/09/NFT_Bone_Shaker.jpg/revision/latest/scale-to-width-down/100?cb=1',
    ),
    'https://static.wikia.nocookie.net/hotwheels/images/0/09/NFT_Bone_Shaker.jpg/revision/latest?cb=1',
  );
});

test('fails fast with snapshot guidance when Fandom returns a bot challenge', () => {
  assert.throws(
    () => assertSuccessfulPageResponse({ status: 403, title: 'Just a moment...' }),
    /normal browser.*--snapshot/i,
  );
});

test('downloads duplicate image references once and records a verified local path', async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'hotwheels-archive-'));
  const outputDirectory = path.join(temporaryRoot, 'assets', 'images', 'virtual-garage');
  let requests = 0;
  const image = {
    alt: 'Bone Shaker',
    sourceUrl: 'https://example.com/NFT_Bone_Shaker.jpg/revision/latest?cb=1',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  };
  const dataset = {
    tables: [
      {
        rows: [
          { cells: [{ images: [structuredClone(image)] }] },
          { cells: [{ images: [structuredClone(image)] }] },
        ],
      },
    ],
  };

  try {
    await downloadDatasetImages(dataset, {
      fetchImpl: async () => {
        requests += 1;
        return new Response(new Uint8Array([0x52, 0x49, 0x46, 0x46]), {
          headers: { 'content-type': 'image/webp' },
          status: 200,
        });
      },
      outputDirectory,
      repositoryRoot: temporaryRoot,
    });

    const [first, second] = dataset.tables.flatMap((table) =>
      table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.images)),
    );
    assert.equal(requests, 1);
    assert.equal(first.localPath, second.localPath);
    assert.match(first.localPath, /^assets\/images\/virtual-garage\/.+\.webp$/);
    assert.equal(first.byteSize, 4);
    assert.match(first.sha256, /^[a-f0-9]{64}$/);
    await access(path.join(temporaryRoot, first.localPath));
    assert.deepEqual([...await readFile(path.join(temporaryRoot, first.localPath))], [82, 73, 70, 70]);
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});
