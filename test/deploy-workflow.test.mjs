import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const workflowPath = path.resolve(import.meta.dirname, '..', '.github', 'workflows', 'deploy.yml');

test('deploy workflow gates a dev push, publishes main, then requests a Pages build', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /push:\s*\n\s*branches:\s*\[dev\]/);
  assert.match(workflow, /contents:\s*write/);
  assert.match(workflow, /pages:\s*write/);
  assert.doesNotMatch(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*read/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(workflow, /actions\/configure-pages@/);
  assert.doesNotMatch(workflow, /actions\/upload-pages-artifact@/);
  assert.doesNotMatch(workflow, /actions\/deploy-pages@/);
  assert.doesNotMatch(workflow, /environment:\s*\n\s*name:\s*github-pages/);
  assert.match(workflow, /command -v google-chrome/);
  assert.match(workflow, /CHROME_PATH=.*GITHUB_ENV/);
  assert.match(workflow, /GH_TOKEN:\s*\$\{\{ github\.token \}\}/);

  const commands = [
    'npm ci',
    'npm test',
    'npm run validate',
    'npm run build',
    'push origin HEAD:main',
    'repos/${GITHUB_REPOSITORY}/pages/builds',
  ];
  const positions = commands.map((command) => workflow.indexOf(command));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});
