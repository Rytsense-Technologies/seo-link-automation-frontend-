import { NextResponse } from "next/server";
import { authResponse } from "@/lib/auth/basic-auth";

/**
 * Runs before every request (Next.js "proxy", formerly middleware): the password gate for the
 * whole app, including the /api/backend proxy. See lib/auth/basic-auth.js.
 */
export async function proxy(request) {
  return (await authResponse(request.headers.get("authorization"))) ?? NextResponse.next();
}

export const config = {
  // Everything except Next's static build assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
