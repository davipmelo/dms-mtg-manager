import { build } from 'esbuild';
import { rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const outDir = resolve('.tmp-tests');
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

try {
  await build({
    entryPoints: [resolve('tests/suite.test.ts')],
    outfile: resolve(outDir, 'suite.test.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: 'inline',
    define: {
      'import.meta.env.VITE_FIREBASE_API_KEY': '""',
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': '""',
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': '""',
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': '""',
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': '""',
      'import.meta.env.VITE_FIREBASE_APP_ID': '""',
      'import.meta.env.VITE_MPC_PROXY_URL': '""',
    },
    external: ['node:test', 'node:assert/strict', 'firebase', 'firebase/*'],
    logLevel: 'silent',
  });

  const result = spawnSync(
    process.execPath,
    ['--enable-source-maps', '--test', resolve(outDir, 'suite.test.mjs')],
    { stdio: 'inherit' }
  );

  process.exitCode = result.status ?? 1;
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
