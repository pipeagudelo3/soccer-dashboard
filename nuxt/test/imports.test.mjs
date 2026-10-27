import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const sourceDirectories = ['app', 'server', 'shared', 'test'];

function collectImports(lines, filePath) {
  const imports = [];

  for (let index = 0; index < lines.length; index++) {
    if (!/^\s*import(?:\s|['"])/.test(lines[index])) continue;

    const firstLine = index + 1;
    let statement = lines[index];

    // Read a complete declaration even when Prettier wraps it across lines.
    while (!/\bfrom\s*['"][^'"]+['"]|^\s*import\s*['"][^'"]+['"]/.test(statement)) {
      assert.ok(index + 1 < lines.length, `${filePath}:${firstLine} has an incomplete import`);
      statement += ` ${lines[++index].trim()}`;
    }

    const match =
      statement.match(/\bfrom\s*['"]([^'"]+)['"]/) ??
      statement.match(/^\s*import\s*['"]([^'"]+)['"]/);
    assert.ok(match, `${filePath}:${firstLine} has an unreadable import`);

    imports.push({
      firstLine,
      lastLine: index + 1,
      internal: /^(#|~|\.|@\/)/.test(match[1]),
      source: match[1],
    });
  }

  return imports;
}

function verifyImportOrder(imports, lines, filePath) {
  for (let index = 1; index < imports.length; index++) {
    const previous = imports[index - 1];
    const current = imports[index];
    const location = `${filePath}:${current.firstLine}`;

    assert.ok(
      !(previous.internal && !current.internal),
      `${location}: external imports must precede internal imports`,
    );

    if (previous.internal !== current.internal) {
      const separator = lines.slice(previous.lastLine, current.firstLine - 1);
      assert.ok(
        separator.some((line) => line.trim() === ''),
        `${location}: separate external and internal imports with a blank line`,
      );
    } else {
      assert.ok(
        previous.source.localeCompare(current.source, 'en', { sensitivity: 'base' }) <= 0,
        `${location}: order ${previous.source} and ${current.source} alphabetically`,
      );
    }
  }
}

test('external and internal imports are separated and alphabetized', async () => {
  const paths = ['eslint.config.mjs', 'nuxt.config.ts'];

  for (const directory of sourceDirectories) {
    const entries = await readdir(join(projectDirectory, directory), { recursive: true });
    for (const entry of entries) {
      if (/\.(mjs|ts|vue)$/.test(entry)) paths.push(join(directory, entry));
    }
  }

  for (const relativePath of paths) {
    const lines = (await readFile(join(projectDirectory, relativePath), 'utf8')).split(/\r?\n/);
    verifyImportOrder(collectImports(lines, relativePath), lines, relativePath);
  }
});
