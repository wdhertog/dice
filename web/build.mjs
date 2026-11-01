// Bundles the web app into the Android assets folder (app/src/main/assets/www).
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../app/src/main/assets/www');
const serve = process.argv.includes('--serve');

mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'style.css']) cpSync(resolve(here, 'public', f), resolve(out, f));

const options = {
  entryPoints: [resolve(here, 'src/main.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome80'],
  minify: !serve,
  sourcemap: serve,
  outfile: resolve(out, 'app.js'),
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 8000 });
  console.log(`Open http://localhost:${port}`);
} else {
  await esbuild.build(options);
}
