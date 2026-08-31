import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepositoryRoot = path.resolve(import.meta.dirname, '..');

function assertSafeOutput(outputDirectory, repositoryRoot) {
  const output = path.resolve(outputDirectory);
  const root = path.resolve(repositoryRoot);
  if (output === root || output === path.parse(output).root) {
    throw new Error(`Refusing to replace unsafe output directory: ${output}`);
  }
}

export async function buildSite({
  outputDirectory = path.join(defaultRepositoryRoot, 'dist'),
  repositoryRoot = defaultRepositoryRoot,
} = {}) {
  assertSafeOutput(outputDirectory, repositoryRoot);
  const dataPath = path.join(repositoryRoot, 'data', 'virtual-garage.json');
  const imageSource = path.join(repositoryRoot, 'assets', 'images', 'virtual-garage');
  const dataset = JSON.parse(await readFile(dataPath, 'utf8'));

  await rm(outputDirectory, { force: true, recursive: true });
  await mkdir(outputDirectory, { recursive: true });
  await cp(path.join(repositoryRoot, 'site'), outputDirectory, { recursive: true });
  await mkdir(path.join(outputDirectory, 'data'), { recursive: true });
  await cp(dataPath, path.join(outputDirectory, 'data', 'virtual-garage.json'));
  await cp(imageSource, path.join(outputDirectory, 'assets', 'images', 'virtual-garage'), {
    recursive: true,
  });
  await writeFile(path.join(outputDirectory, '.nojekyll'), '');

  const imageCount = (await readdir(imageSource, { withFileTypes: true }))
    .filter((entry) => entry.isFile()).length;
  return { imageCount, outputDirectory, rowCount: dataset.stats.rowCount };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summary = await buildSite();
  console.log(`Built ${summary.rowCount} rows and ${summary.imageCount} images in ${summary.outputDirectory}`);
}
