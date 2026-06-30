import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { attachConsoleProxy } from './lib/server/consoleProxy';

// Custom server so we can own the WebSocket upgrade for the console proxy —
// something Next.js API routes can't do cleanly.
const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '0.0.0.0';

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url || '', true));
  });

  attachConsoleProxy(server);

  server.listen(port, hostname, () => {
    // eslint-disable-next-line no-console
    console.log(`▲ ProxLink ready on http://${hostname}:${port}`);
  });
});
