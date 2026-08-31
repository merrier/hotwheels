// Paste this entire file into DevTools Console on the loaded Virtual Garage page.
(() => {
  const extract = function extractVirtualGarageFromDocument(metadata = {}) {
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
};
  const dataset = extract({ sourceUrl: "https://hotwheels.fandom.com/wiki/Virtual_Garage", sourceTitle: document.title });
  const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = 'virtual-garage-extracted.json';
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  console.info('Exported', dataset.tables.length, 'tables');
})();
