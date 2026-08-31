# Hot Wheels Virtual Garage archive

This repository archives the tables and images from the Hot Wheels Wiki
[Virtual Garage](https://hotwheels.fandom.com/wiki/Virtual_Garage) page for use by a future static site.

## Refresh the archive

Requirements: Node.js 20+ and Google Chrome. Set `CHROME_PATH` if Chrome is not installed at the
default macOS path.

```bash
npm install
npm run scrape
npm run validate
```

The live command blocks page images and advertising while reading the table DOM, then downloads each
unique original table image directly. It does not delete older, unreferenced image files.

Fandom may return a Cloudflare challenge to automated Chrome. When that happens, use the normal
browser path instead of trying to bypass it:

1. Open the Virtual Garage page normally and wait for its tables to load.
2. Open Chrome DevTools Console and run the full contents of `tools/export-virtual-garage.js`.
3. Import the downloaded snapshot:

```bash
npm run scrape -- --snapshot /absolute/path/to/virtual-garage-extracted.json
npm run validate
```

## Repository output

- `data/virtual-garage.json`: all 34 page tables, including section hierarchy, cell text, links,
  source image URLs, local image paths, byte sizes, content types, and SHA-256 checksums.
- `assets/images/virtual-garage/`: downloaded original images, deduplicated by source URL.

Each table has a `type` of `physical`, `collectibles`, or `completion`. To display only NFTH physical
models, select rows from `physical` tables where `values.Rarity === "NFTH"`.

## Development

```bash
npm test
```

Regenerate the normal-browser helper after changing the extractor:

```bash
npm run build:browser-export
```
