// Clustered production server. `next start` runs as a single Node process,
// so under concurrent load every request — including CPU-heavy ones like
// rendering a large board — queues behind the one event loop even though
// the container has multiple cores sitting idle. This forks one Next.js
// request handler per core (capped — see WORKERS below) behind Node's
// built-in cluster module, which round-robins incoming connections across
// them, so concurrent requests actually run in parallel instead of taking
// turns on a single thread.
const cluster = require("cluster");
const os = require("os");
const http = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
// Leave at least one core free for the OS/Postgres client work; cap at 4
// even on bigger hosts since each worker holds its own Prisma connection
// pool and duplicates Next.js's in-memory caches.
const WORKERS = Math.max(1, Math.min(4, os.cpus().length - 1 || 1));

if (cluster.isPrimary && !dev) {
  console.log(`Starting ${WORKERS} worker process(es)...`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} exited (code=${code} signal=${signal}), restarting...`);
    cluster.fork();
  });
} else {
  const app = next({ dev });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    http
      .createServer((req, res) => {
        handle(req, res);
      })
      .listen(port, () => {
        console.log(`Worker ${process.pid} ready on http://localhost:${port}`);
      });
  });
}
