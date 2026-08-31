import assert from 'node:assert/strict';
import test from 'node:test';

import { createCatalog, filterCatalog, getFilterOptions } from '../site/catalog.js';

const image = (column, localPath) => ({
  column,
  images: [{ alt: 'car', localPath }],
  links: [],
  text: '',
});

const dataset = {
  scrapedAt: '2026-08-31T09:09:07.561Z',
  stats: { rowCount: 3 },
  tables: [
    {
      section: 'Main Series',
      subsection: 'Series 1',
      tableIndex: 0,
      type: 'physical',
      rows: [{
        cells: [
          { column: 'Casting Name', images: [], links: [{ href: 'https://example.com/bone' }], text: 'Bone Shaker' },
          image('Photo Loose', 'assets/images/virtual-garage/bone-loose.webp'),
          image('Photo Carded', 'assets/images/virtual-garage/bone-carded.webp'),
        ],
        rowIndex: 0,
        values: {
          'Card ID': '#01',
          'Casting Name': 'Bone Shaker',
          Color: 'Spectraflame red',
          Quantity: '600',
          Rarity: 'NFTH',
          'Toy #': 'HLP65',
          'Wheel Type': 'RR5SP',
        },
      }],
    },
    {
      section: 'Main Series',
      subsection: 'Series 1',
      tableIndex: 1,
      type: 'collectibles',
      rows: [{
        cells: [],
        rowIndex: 0,
        values: {
          'Card ID': '#14',
          'Casting Name': "'18 Camaro SS",
          ExpandSegment: 'Muscle Cars',
          Rarity: 'Premium',
        },
      }],
    },
    {
      section: 'Series Completion Cars',
      subsection: null,
      tableIndex: 2,
      type: 'completion',
      rows: [{
        cells: [],
        rowIndex: 0,
        values: {
          'Casting Name': "'83 Chevy Silverado",
          Quantity: '1,200',
          Year: '2022',
        },
      }],
    },
  ],
};

test('normalizes physical, collectible, and completion rows for display', () => {
  const catalog = createCatalog(dataset);

  assert.equal(catalog.physical.length, 2);
  assert.equal(catalog.collectibles.length, 1);
  assert.equal(catalog.physical[0].castingName, 'Bone Shaker');
  assert.equal(catalog.physical[0].series, 'Series 1');
  assert.equal(catalog.physical[0].sourceUrl, 'https://example.com/bone');
  assert.deepEqual(catalog.physical[0].images, {
    carded: 'assets/images/virtual-garage/bone-carded.webp',
    loose: 'assets/images/virtual-garage/bone-loose.webp',
  });
  assert.equal(catalog.physical[1].series, 'Series Completion Cars');
  assert.equal(catalog.physical[1].rarity, 'Completion');
  assert.equal(catalog.collectibles[0].segment, 'Muscle Cars');
});

test('filters across text fields, series, and rarity without mutating input', () => {
  const { physical } = createCatalog(dataset);

  assert.deepEqual(filterCatalog(physical, { query: 'hlp65' }).map((item) => item.castingName), [
    'Bone Shaker',
  ]);
  assert.deepEqual(filterCatalog(physical, { query: 'silverado', series: 'Series Completion Cars' })
    .map((item) => item.castingName), ["'83 Chevy Silverado"]);
  assert.equal(filterCatalog(physical, { rarity: 'Premium' }).length, 0);
  assert.equal(physical.length, 2);
});

test('returns sorted filter options for the active view', () => {
  const catalog = createCatalog(dataset);

  assert.deepEqual(getFilterOptions(catalog.physical), {
    rarities: ['Completion', 'NFTH'],
    series: ['Series 1', 'Series Completion Cars'],
  });
  assert.deepEqual(getFilterOptions(catalog.collectibles), {
    rarities: ['Premium'],
    series: ['Series 1'],
  });
});

test('uses a feature drop type as its display rarity', () => {
  const featureDrop = {
    tables: [{
      section: 'Feature Drops',
      subsection: 'Fast & Furious',
      tableIndex: 0,
      type: 'physical',
      rows: [{
        cells: [],
        rowIndex: 0,
        values: { 'Casting Name': 'Honda S2000', Type: 'Chrome' },
      }],
    }],
  };

  assert.equal(createCatalog(featureDrop).physical[0].rarity, 'Chrome');
});
