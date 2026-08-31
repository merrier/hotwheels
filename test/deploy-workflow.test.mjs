import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const workflowPath = path.resolve(import.meta.dirname, '..', '.github', 'workflows', 'deploy.yml');

test('deploy workflow gates a dev push before publishing main and Pages', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /push:\s*\n\s*branches:\s*\[dev\]/);
  assert.match(workflow, /contents:\s*write/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /actions:\s*read/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.match(workflow, /actions\/configure-pages@v6/);
  assert.match(workflow, /actions\/upload-pages-artifact@v5/);
  assert.match(workflow, /actions\/deploy-pages@v5/);
  assert.match(workflow, /command -v google-chrome/);
  assert.match(workflow, /CHROME_PATH=.*GITHUB_ENV/);

  const commands = ['npm ci', 'npm test', 'npm run validate', 'npm run build', 'push origin HEAD:main'];
  const positions = commands.map((command) => workflow.indexOf(command));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});
