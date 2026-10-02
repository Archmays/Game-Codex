/** Run the existing deep scene harnesses against an owned, isolated server. */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer, preview, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';

const game = process.argv[2];
if (game !== 'world-in-a-box' && game !== 'oddity-puzzles') throw new Error('Expected world-in-a-box or oddity-puzzles');
const port = Number(process.env.SCENE_TEST_PORT ?? (game === 'world-in-a-box' ? 4193 : 4194));
if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 5175) throw new Error('Use a valid isolated test port, never the family server 5175');
const output = resolve(process.env.GAME_CODEX_EVIDENCE_ROOT ?? 'test-results', game);
await mkdir(output, { recursive: true });
const external = process.env.SCENE_BASE_URL;
if (external && new URL(external).port === '5175') throw new Error('The family origin is not a test target');
const origin = external ?? `http://127.0.0.1:${port}`;
let closeServer: (() => Promise<void>) | undefined;
let closeSourceServer: (() => Promise<void>) | undefined;
let child: ReturnType<typeof spawn> | undefined;
const stop = () => { child?.kill(); };
process.once('SIGINT', stop); process.once('SIGTERM', stop);
// Existing deep checks exercise the published /Game-Codex/ base as well as root.
// Serve the same bytes there; leave the browser URL/baseURI unchanged.
const subpathAlias: Plugin = {
  name: 'isolated-scene-test-subpath',
  configureServer(server) { server.middlewares.use(alias); },
  configurePreviewServer(server) { server.middlewares.use(alias); },
};
function alias(request: IncomingMessage, _response: ServerResponse, next: () => void): void {
  if (request.url?.startsWith('/Game-Codex/')) request.url = request.url.slice('/Game-Codex'.length);
  next();
}

async function run(args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  console.log(`node ${args.join(' ')}`);
  await new Promise<void>((done, fail) => {
    child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...environment } });
    child.once('error', fail);
    child.once('exit', (code, signal) => { child = undefined; code === 0 ? done() : fail(new Error(`Scene check exited ${code ?? signal}`)); });
  });
}

try {
  if (!external) {
    if (process.argv.includes('--preview')) {
      const server = await preview({ plugins: [subpathAlias], preview: { host: '127.0.0.1', port, strictPort: true } });
      closeServer = () => new Promise<void>((done, fail) => server.httpServer.close(error => error ? fail(error) : done()));
    } else {
      const server = await createServer({ plugins: [subpathAlias], server: { host: '127.0.0.1', port, strictPort: true } });
      await server.listen(); closeServer = () => server.close();
    }
  }
  if (game === 'world-in-a-box') {
    const scripts = ['browser-check', 'edge-check', 'dresden-browser', 'dresden-edges', 'dresden-geometry', 'dresden-recovery', 'step03-exploration', 'step03-interactions', 'step03-surface', 'step03-faults', 'frozen-matrix', 'frozen-edges', 'frozen-passengers', 'refine-actions'];
    const selected = process.env.SCENE_CHECKS?.split(',') ?? scripts;
    // These existing harnesses inspect exported meshes or install source hooks.
    // Keep them distinct from gameplay evidence against the production build.
    const sourceChecks = new Set(['dresden-geometry', 'step03-surface', 'refine-actions']);
    if (external && selected.some(script => sourceChecks.has(script))) throw new Error('Source inspection requires an owned local Vite server; omit SCENE_BASE_URL or select only production checks.');
    let sourceOrigin = origin;
    if (process.argv.includes('--preview') && selected.some(script => sourceChecks.has(script))) {
      const sourcePort = 4197;
      if (port === sourcePort) throw new Error('The source inspection port 4197 must differ from the preview port.');
      const sourceServer = await createServer({ plugins: [subpathAlias], server: { host: '127.0.0.1', port: sourcePort, strictPort: true } });
      closeSourceServer = () => sourceServer.close(); await sourceServer.listen();
      sourceOrigin = `http://127.0.0.1:${sourcePort}`;
    }
    for (const script of selected) {
      if (!scripts.includes(script)) throw new Error(`Unknown current scene check: ${script}`);
      const inspection = sourceChecks.has(script);
      console.log(`[${inspection ? 'source inspection' : process.argv.includes('--preview') ? 'production gameplay' : 'development gameplay'}] ${script} ${inspection ? sourceOrigin : origin}`);
      await run(['tools/world-in-a-box/run-browser.mjs', `tools/world-in-a-box/${script}.js`, `${output}/${script}.json`], {
        QA_ORIGIN: inspection ? sourceOrigin : origin, QA_EVIDENCE_ROOT: `${output.replaceAll('\\', '/')}/screenshots/`, QA_SCRATCH_ROOT: `${output.replaceAll('\\', '/')}/scratch`,
      });
    }
  } else {
    await run(['tools/oddity-puzzles/browser-v020.mjs'], { ODDITY_ORIGIN: origin, ODDITY_OUTPUT: `${output}/browser` });
    await run(['tools/oddity-puzzles/lifecycle-v020.mjs'], { ODDITY_ORIGIN: origin, ODDITY_OUTPUT: `${output}/lifecycle` });
  }
} finally {
  stop();
  try { await closeSourceServer?.(); } finally {
    try { await closeServer?.(); } finally {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    }
  }
}
