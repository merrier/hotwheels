# Hot Wheels Virtual Garage archive

This repository archives the tables and images from the Hot Wheels Wiki
[Virtual Garage](https://hotwheels.fandom.com/wiki/Virtual_Garage) page and turns them into a
searchable static catalogue.

## Branches and deployment

- `dev` is the source branch. It contains the scraper, archived data and images, website source,
  tests, build scripts, and GitHub Actions workflow.
- `main` is generated. It contains only the static files produced in `dist/`.
- Every push to `dev` runs the tests, validates the archive, builds the site, updates `main`, and
  requests a GitHub Pages build from the updated `main` branch.

GitHub Pages is configured to deploy from `main` at `/ (root)`. Repository Actions must be allowed
to write contents and Pages. The workflow requests the Pages branch build explicitly after updating
`main`, because commits made with `GITHUB_TOKEN` do not trigger a Pages build on their own.

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
npm run validate
npm run dev
```

The local preview is available at `http://127.0.0.1:4173`. Create a production artifact with:

```bash
npm run build
```

The website uses native HTML, CSS, and JavaScript modules. It has no CDN or runtime framework, and
all displayed car images are served from this repository.

Regenerate the normal-browser helper after changing the extractor:

```bash
npm run build:browser-export
```
