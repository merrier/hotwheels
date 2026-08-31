import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const chromePath =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function imageDataUrl(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="red"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

test('keeps loose and carded images completely inside the media frame', async () => {
  const styles = await readFile(path.join(repositoryRoot, 'site', 'styles.css'), 'utf8');
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  try {
    await page.setContent(`
      <style>${styles}</style>
      <div style="width: 365px"><div class="car-media"><img alt="Test car"></div></div>
    `);

    for (const [label, source] of [
      ['loose', imageDataUrl(1000, 1000)],
      ['carded', imageDataUrl(827, 1253)],
    ]) {
      const metrics = await page.locator('.car-media').evaluate(async (media, imageSource) => {
        const image = media.querySelector('img');
        image.src = imageSource;
        await image.decode();
        const mediaRect = media.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        return {
          imageHeight: imageRect.height,
          imageWidth: imageRect.width,
          mediaHeight: mediaRect.height,
          mediaWidth: mediaRect.width,
        };
      }, source);

      assert.ok(metrics.imageWidth <= metrics.mediaWidth, `${label} image overflows horizontally`);
      assert.ok(metrics.imageHeight <= metrics.mediaHeight, `${label} image overflows vertically`);
    }
  } finally {
    await browser.close();
  }
});
