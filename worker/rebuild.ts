import type { Context } from "hono";
import type { AppEnv } from "./env";
import { waitUntil } from "./middleware";

/**
 * Ask GitHub Actions to rebuild and redeploy the static site.
 *
 * Circuit pages are static files built from the database, so a circuit that
 * is deleted, made private or renamed keeps its old public page until the
 * next build. Edits that change what a page shows call this to run the
 * deploy workflow (.github/workflows/deploy.yml) straight away instead of
 * waiting for the daily build. The workflow's concurrency group keeps at most
 * one build running and one queued, so bursts of edits share a build.
 *
 * A no-op unless GITHUB_DEPLOY_TOKEN is set (a fine-grained token for this
 * repository with "Actions: Read and write"). Never fails the request: the
 * call runs after the response, and errors are only logged.
 */
export function requestRebuild(c: Context<AppEnv>, reason: string): void {
  const token = c.env.GITHUB_DEPLOY_TOKEN;
  if (!token) return;
  const repo = c.env.GITHUB_REPOSITORY || "MichaelAyles/kicad-library";

  const dispatch = fetch(
    `https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "circuitsnips-worker",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  )
    .then((response) => {
      if (!response.ok) {
        console.warn(
          `Rebuild request (${reason}) failed: HTTP ${response.status}`,
        );
      }
    })
    .catch((error) => {
      console.warn(`Rebuild request (${reason}) failed:`, error);
    });

  void waitUntil(c, dispatch);
}
