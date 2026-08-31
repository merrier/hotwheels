import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SOURCE_URL = 'https://hotwheels.fandom.com/wiki/Virtual_Garage';

export function assertSuccessfulPageResponse({ status, title }) {
  if (status === 403 || /just a moment/i.test(title || '')) {
    throw new Error(
      'Fandom returned its automated-traffic challenge. Open the page in a normal browser, '
      + 'run tools/export-virtual-garage.js there, then rerun with --snapshot <downloaded-file>.',
    );
  }
  if (status >= 400) throw new Error(`Fandom returned HTTP ${status}.`);
}

export function extractVirtualGarageFromDocument(metadata = {}) {
  const clean = (value) => (value || '').replace(/\[\s*\]/g, '').replace(/\s+/g, ' ').trim();
  const absolute = (value) => {
    if (!value) return null;
    try {
      return new URL(value, metadata.sourceUrl || document.baseURI).href;
    } catch {
      return null;
    }
  };
  const headingText = (heading) => {
    const editText = heading.querySelector('.mw-editsection')?.textContent || '';
    return clean((heading.textContent || '').replace(editText, ''));
  };
  const imageUrl = (image) => {
    for (const attribute of ['data-src', 'data-original', 'src']) {
      const value = image.getAttribute(attribute);
      if (value && !value.startsWith('data:')) return absolute(value);
    }
    return image.currentSrc && !image.currentSrc.startsWith('data:')
      ? absolute(image.currentSrc)
      : null;
  };
  const headingContext = (table) => {
    let cursor = (table.closest('.table-wide') || table).previousElementSibling;
    const found = {};
    while (cursor) {
      if (['H2', 'H3', 'H4'].includes(cursor.tagName) && !found[cursor.tagName]) {
        found[cursor.tagName] = {
          id: cursor.querySelector('[id]')?.id || cursor.id || null,
          text: headingText(cursor),
        };
      }
      if (found.H2) break;
      cursor = cursor.previousElementSibling;
    }
    return found;
  };

  const tables = [...document.querySelectorAll('.mw-parser-output table.wikitable')].map(
    (table, tableIndex) => {
      const heading = headingContext(table);
      const tableRows = [...table.rows];
      const headers = [...(tableRows[0]?.cells || [])].map((cell) => clean(cell.textContent));
      const rows = tableRows.slice(1).map((row, rowIndex) => {
        const cells = [...row.cells].map((cell, cellIndex) => {
          const images = [...cell.querySelectorAll('img')]
            .map((image) => {
              const thumbnailUrl = imageUrl(image);
              return {
                alt: clean(image.getAttribute('alt')),
                sourceUrl: absolute(image.closest('a')?.getAttribute('href')) || thumbnailUrl,
                thumbnailUrl,
              };
            })
            .filter((image) => image.sourceUrl);
          return {
            column: headers[cellIndex] || `column_${cellIndex + 1}`,
            images,
            links: [...cell.querySelectorAll('a')]
              .map((link) => ({
                href: absolute(link.getAttribute('href')),
                text: clean(link.textContent),
              }))
              .filter((link) => link.href && !link.href.startsWith('javascript:')),
            text: clean(cell.textContent),
          };
        });
        return {
          cells,
          rowIndex,
          values: Object.fromEntries(cells.map((cell) => [cell.column, cell.text])),
        };
      });
      const type = headers[0] === 'Year'
        ? 'completion'
        : headers.some((header) => header.startsWith('Photo '))
          ? 'physical'
          : 'collectibles';
      return {
        headers,
        rows,
        section: heading.H2?.text || null,
        sectionId: heading.H2?.id || null,
        subsection: heading.H3?.text || null,
        subsectionId: heading.H3?.id || null,
        tableIndex,
        title: heading.H4?.text || heading.H3?.text || heading.H2?.text || null,
        titleId: heading.H4?.id || heading.H3?.id || heading.H2?.id || null,
        type,
      };
    },
  );

  return {
    scrapedAt: new Date().toISOString(),
    sourceTitle: metadata.sourceTitle || document.title,
    sourceUrl: metadata.sourceUrl || document.location.href,
    tables,
  };
}

export function normalizeOriginalImageUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(
    /\/revision\/latest\/(?:scale-to-width-down|smart)\/[^?]+$/,
    '/revision/latest',
  );
  return url.href;
}

function allImages(dataset) {
  return dataset.tables.flatMap((table) =>
    table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.images || [])),
  );
}

export function summarizeDataset(dataset) {
  const images = allImages(dataset);
  const uniqueImages = new Set(images.map((image) => normalizeOriginalImageUrl(image.sourceUrl)));
  return {
    tableCount: dataset.tables.length,
    rowCount: dataset.tables.reduce((count, table) => count + table.rows.length, 0),
    imageReferenceCount: images.length,
    uniqueImageCount: uniqueImages.size,
    nfthPhysicalCount: dataset.tables
      .filter((table) => table.type === 'physical')
      .flatMap((table) => table.rows)
      .filter((row) => row.values.Rarity === 'NFTH').length,
  };
}

function extensionFor(contentType, sourceUrl) {
  const known = new Map([
    ['image/avif', '.avif'],
    ['image/gif', '.gif'],
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/svg+xml', '.svg'],
    ['image/webp', '.webp'],
  ]);
  if (known.has(contentType)) return known.get(contentType);
  const sourceName = decodeURIComponent(new URL(sourceUrl).pathname.split('/revision/')[0]);
  return path.extname(sourceName).toLowerCase() || '.img';
}

function imageFilename(sourceUrl, contentType) {
  const url = new URL(sourceUrl);
  const originalName = decodeURIComponent(url.pathname.split('/revision/')[0].split('/').pop());
  const stem = originalName
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'image';
  const digest = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 10);
  return `${stem}-${digest}${extensionFor(contentType, sourceUrl)}`;
}

async function fetchImage(sourceUrl, { fetchImpl, retries }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(sourceUrl, {
        headers: {
          accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
          'user-agent': 'HotWheelsVirtualGarageArchive/1.0',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('empty response');
      return {
        bytes,
        contentType: response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw new Error(`Failed to download ${sourceUrl}: ${lastError.message}`);
}

export async function downloadDatasetImages(
  dataset,
  {
    concurrency = 6,
    fetchImpl = fetch,
    outputDirectory,
    repositoryRoot,
    retries = 3,
  },
) {
  const references = allImages(dataset);
  const grouped = new Map();
  for (const image of references) {
    const sourceUrl = normalizeOriginalImageUrl(image.sourceUrl);
    image.sourceUrl = sourceUrl;
    if (!grouped.has(sourceUrl)) grouped.set(sourceUrl, []);
    grouped.get(sourceUrl).push(image);
  }

  await mkdir(outputDirectory, { recursive: true });
  const queue = [...grouped.entries()];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const [sourceUrl, imageReferences] = queue.shift();
      const { bytes, contentType } = await fetchImage(sourceUrl, { fetchImpl, retries });
      const filePath = path.join(outputDirectory, imageFilename(sourceUrl, contentType));
      await writeFile(filePath, bytes);
      const metadata = {
        byteSize: bytes.length,
        contentType,
        localPath: path.relative(repositoryRoot, filePath).split(path.sep).join('/'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
      for (const image of imageReferences) Object.assign(image, metadata);
    }
  });
  await Promise.all(workers);
  return dataset;
}
