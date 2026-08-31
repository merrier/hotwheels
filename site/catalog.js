function valueMatching(values, label) {
  const key = Object.keys(values).find((candidate) => candidate === label || candidate.endsWith(label));
  return key ? values[key] : '';
}

function firstImage(row, label) {
  const cell = row.cells.find((candidate) => candidate.column.includes(label));
  return cell?.images.find((image) => image.localPath)?.localPath || '';
}

function normalizeRow(table, row) {
  const values = row.values || {};
  const castingCell = row.cells.find((cell) => cell.column === 'Casting Name');
  const series = table.subsection || table.title || table.section || 'Other';
  const rarity = values.Rarity || values.Type || (table.type === 'completion' ? 'Completion' : 'Unknown');
  const item = {
    cardId: values['Card ID'] || values.Year || '',
    castingName: values['Casting Name'] || 'Unknown casting',
    color: values.Color || '',
    group: table.section || 'Other',
    id: `${table.type}-${table.tableIndex}-${row.rowIndex}`,
    images: {
      carded: firstImage(row, 'Carded') || firstImage(row, 'Boxed'),
      loose: firstImage(row, 'Loose'),
    },
    quantity: values.Quantity || '',
    rarity,
    segment: valueMatching(values, 'Segment'),
    series,
    sourceUrl: castingCell?.links?.[0]?.href || '',
    toyNumber: values['Toy #'] || '',
    type: table.type,
    wheelType: values['Wheel Type'] || '',
  };
  item.searchText = Object.values(item)
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase();
  return item;
}

export function createCatalog(dataset) {
  const physical = [];
  const collectibles = [];

  for (const table of dataset.tables || []) {
    const target = table.type === 'collectibles' ? collectibles : physical;
    for (const row of table.rows || []) target.push(normalizeRow(table, row));
  }

  return {
    collectibles,
    physical,
    scrapedAt: dataset.scrapedAt || '',
    sourceUrl: dataset.sourceUrl || '',
    stats: {
      archivedRows: dataset.stats?.rowCount ?? physical.length + collectibles.length,
      collectibles: collectibles.length,
      nfth: physical.filter((item) => item.rarity === 'NFTH').length,
      physical: physical.length,
    },
  };
}

export function filterCatalog(items, { query = '', rarity = '', series = '' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return items.filter((item) => (
    (!normalizedQuery || item.searchText.includes(normalizedQuery))
    && (!rarity || item.rarity === rarity)
    && (!series || item.series === series)
  ));
}

export function getFilterOptions(items) {
  const sortedUnique = (values) => [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  return {
    rarities: sortedUnique(items.map((item) => item.rarity)),
    series: sortedUnique(items.map((item) => item.series)),
  };
}
