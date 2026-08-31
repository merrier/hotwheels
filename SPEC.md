# Virtual Garage static site specification

## Goal

Turn the archived Hot Wheels Virtual Garage data into a fast, self-contained static catalogue.
Source files live on `dev`; `main` contains only the generated website.

## Repository contract

- `dev`: scraper, archived JSON and images, site source, tests, build scripts, and CI workflow.
- `main`: the exact contents of `dist/`, with no Node.js source or scraper files.
- A push to `dev` must test, validate, build, replace `main` with `dist/`, and deploy that same
  artifact to GitHub Pages.
- The workflow uses GitHub Pages' GitHub Actions source. No custom domain is configured.

## Product scope

- Default view: redeemable physical models, with NFTH clearly identified.
- Alternate view: every archived collectible.
- Search casting name, card ID, toy number, color, wheel type, and segment.
- Filter by series and rarity; reset all filters.
- Show locally archived loose and carded photos where available.
- Show result counts, data refresh time, loading, empty, and error states.
- Work at 320 px, tablet, and desktop widths; all controls are keyboard accessible.

## Technical approach

- Native HTML, CSS, and JavaScript modules; no runtime framework or external CDN.
- `site/catalog.js` contains pure data transformation and filtering logic.
- `site/app.js` owns DOM rendering and interaction.
- `scripts/build-site.mjs` creates `dist/` from site source, JSON, and local images.
- `scripts/serve-site.mjs` serves a local build for manual browser verification.
- Node's built-in test runner covers catalogue logic, build output, and deployment workflow rules.

## Visual direction

Editorial garage catalogue: warm off-white canvas, charcoal surfaces, racing red accents, yellow
status marks, compact technical metadata, and large authentic product photography. Avoid external
fonts, gradients, ornamental animation, and imitation of Fandom's advertising-heavy layout.

## Success criteria

1. `npm test`, `npm run validate`, and `npm run build` pass on `dev`.
2. The built site uses only relative/local assets and can run from a GitHub project Pages path.
3. Search, view switching, filtering, reset, and incremental loading work in a real browser.
4. No console errors occur at 320 px, 768 px, or desktop widths.
5. `main` is reproducible from `dev` and contains only static output.
6. The workflow deploys only after tests and archive validation pass.
