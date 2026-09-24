import { proxyToBackend } from "@/lib/app-api/proxy";

/**
 * BFF entry point: browser -> Next.js -> Fastify.
 *
 * /api/backend/interlink/suggestions?status=PENDING
 *   -> ${BACKEND_API_URL}/api/interlink/suggestions?status=PENDING
 *
 * Only the path is forwarded; the backend's routes are the contract, so nothing here needs to
 * change when an endpoint is added. Runs on the Node runtime because it reads server-only env.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request, context) {
  const { path } = await context.params;
  return proxyToBackend(request, `/api/${path.join("/")}`);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
