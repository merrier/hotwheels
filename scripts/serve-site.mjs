import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { buildSite } from './build-site.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(repositoryRoot, 'dist');
const port = Number.parseInt(process.env.PORT || '4173', 10);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

await buildSite({ outputDirectory, repositoryRoot });

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(outputDirectory, requested);
    if (!filePath.startsWith(`${outputDirectory}${path.sep}`)) throw new Error('Invalid path');
    const details = await stat(filePath);
    if (!details.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'content-length': details.size,
      'content-type': contentTypes.get(path.extname(filePath)) || 'application/octet-stream',
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Virtual Garage site: http://127.0.0.1:${port}`);
});
