import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('the standalone font policy permits the Graffiti sign-in font', async () => {
  const sdk = new URL('../node_modules/@graffiti-garden/implementation-decentralized/dist/browser/', import.meta.url);
  const files = await readdir(sdk);
  const assets = await Promise.all(files.filter(file => file.endsWith('.js')).map(file =>
    readFile(new URL(file, sdk), 'utf8')));
  const fontUrl = assets.map(asset => asset.match(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/)?.[0])
    .find(Boolean);
  assert.ok(fontUrl, 'The pinned browser bundle includes a data URL for the sign-in font');

  const headers = await readFile(new URL('../release/_headers', import.meta.url), 'utf8');
  const fontSources = headers.match(/\bfont-src\s+([^;\n]+)/)?.[1].split(/\s+/) ?? [];
  assert.ok(fontSources.includes(new URL(fontUrl).protocol), 'Pages permits the embedded sign-in font');
});
