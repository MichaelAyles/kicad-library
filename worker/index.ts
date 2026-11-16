/**
 * CircuitSnips API worker.
 *
 * The site is a static export served as Workers static assets; assets are
 * matched first, so this worker only sees /api/* requests and asset misses.
 * Every former Next route handler (src/app/api/**) lives here at the same
 * path and method with the same JSON shapes. Auth is a Bearer access token
 * (see auth.ts); there are no cookies.
 */

import { Hono } from "hono";
import type { AppEnv, Env } from "./env";
import { serveAssetFallback } from "./assets";
import { rateLimit } from "./middleware";
import adminRoutes from "./routes/admin";
import circuitRoutes from "./routes/circuits";
import publicRoutes from "./routes/public";
import userRoutes from "./routes/user";

export const app = new Hono<AppEnv>();

app.use("/api/*", rateLimit());

app.route("/", publicRoutes);
app.route("/", circuitRoutes);
app.route("/", userRoutes);
app.route("/", adminRoutes);

app.notFound((c) => serveAssetFallback(c));

app.onError((error, c) => {
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, error);
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    app.fetch(request, env, ctx),
} satisfies ExportedHandler<Env>;
