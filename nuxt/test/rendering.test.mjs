import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));

test('production build satisfies the hybrid rendering contract', { timeout: 60_000 }, async (t) => {
  // Reserve a free local port so the developer's running app does not affect the test.
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const address = reservation.address();
  assert.ok(address && typeof address === 'object');
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );

  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    cwd: projectDirectory,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(address.port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (data) => {
    output += String(data);
  });
  server.stderr.on('data', (data) => {
    output += String(data);
  });
  const closed = once(server, 'close');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        ready = (await fetch(`${baseUrl}/api/teams`, { signal: AbortSignal.timeout(1000) })).ok;
      } catch {
        /* The child process has not started listening yet. */
      }
      if (ready || server.exitCode !== null) break;
      await setTimeout(100);
    }
    assert.ok(ready, `Production server did not start:\n${output}`);

    await t.test('blog index and all three complete articles exist as static HTML', async () => {
      const articles = [
        [
          'leer-la-tabla',
          'Cómo leer una tabla de posiciones',
          'Una tabla de posiciones resume resultados',
        ],
        [
          'conocer-un-equipo',
          'Qué nos cuenta la ficha de un equipo',
          'El nombre identifica a un equipo',
        ],
        [
          'comparar-con-contexto',
          'Comparar estadísticas con contexto',
          'Un resultado aislado puede estar condicionado',
        ],
      ];
      const index = await readFile(
        new URL('../.output/public/blog/index.html', import.meta.url),
        'utf8',
      );
      for (const [slug, title, paragraph] of articles) {
        assert.ok(index.includes(`/blog/${slug}`));
        const html = await readFile(
          new URL(`../.output/public/blog/${slug}/index.html`, import.meta.url),
          'utf8',
        );
        assert.ok(html.includes(title));
        assert.ok(
          html.includes(`<p>${paragraph}`),
          'Full article must be in the HTML, not only its payload',
        );
        assert.equal((await fetch(`${baseUrl}/blog/${slug}`)).status, 200);
      }
    });

    await t.test('API list/detail and HTTP error responses have consistent contracts', async () => {
      const response = await fetch(`${baseUrl}/api/teams`);
      assert.equal(response.status, 200);
      const teams = await response.json();
      assert.equal(teams.length, 4);
      assert.equal(new Set(teams.map((team) => team.id)).size, 4);
      for (const team of teams) {
        const detail = await fetch(`${baseUrl}/api/teams/${team.id}`);
        assert.equal(detail.status, 200);
        assert.deepEqual(await detail.json(), team);
      }
      assert.equal((await fetch(`${baseUrl}/api/teams/invalid`)).status, 400);
      assert.equal(
        (await fetch(`${baseUrl}/api/teams/99999999-9999-4999-8999-999999999999`)).status,
        404,
      );
    });

    await t.test(
      'teams are rendered into each HTTP response, without prerendered pages',
      async () => {
        const listResponse = await fetch(`${baseUrl}/teams`);
        assert.equal(listResponse.status, 200);
        assert.match(await listResponse.text(), /<h2[^>]*>.*Andes FC/s);
        const detailResponse = await fetch(`${baseUrl}/teams/11111111-1111-4111-8111-111111111111`);
        assert.equal(detailResponse.status, 200);
        const detailHtml = await detailResponse.text();
        assert.match(detailHtml, /<h1[^>]*>Andes FC<\/h1>/);
        assert.ok(detailHtml.includes('Estadio de la Montaña'));
        await assert.rejects(
          access(new URL('../.output/public/teams/index.html', import.meta.url)),
          { code: 'ENOENT' },
        );
        assert.equal(
          (await fetch(`${baseUrl}/teams/99999999-9999-4999-8999-999999999999`)).status,
          404,
        );
        assert.equal((await fetch(`${baseUrl}/teams/invalid`)).status, 404);
      },
    );

    await t.test('tools and both children send a CSR shell without page content', async () => {
      for (const path of ['/tools', '/tools/points', '/tools/faq']) {
        const response = await fetch(`${baseUrl}${path}`);
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes('id="__nuxt"'));
        assert.ok(!html.includes('<h1'));
        assert.ok(!html.includes('id="wins"'));
        assert.ok(!html.includes('<summary'));
        await assert.rejects(
          access(new URL(`../.output/public${path}/index.html`, import.meta.url)),
          { code: 'ENOENT' },
        );
      }
    });

    await t.test('missing blog and unrelated URLs respond with 404', async () => {
      for (const path of ['/blog/not-an-article', '/not-a-page']) {
        assert.equal((await fetch(`${baseUrl}${path}`)).status, 404);
      }
    });
  } finally {
    server.kill('SIGTERM');
    await closed;
  }
});
