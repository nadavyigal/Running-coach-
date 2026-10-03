import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const maplibreDistDir = dirname(require.resolve('maplibre-gl/package.json'));
const outputDir = join(process.cwd(), 'public', 'maplibre');

mkdirSync(outputDir, { recursive: true });

for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(maplibreDistDir, 'dist', file), join(outputDir, file));
}
