import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - any path with a file extension (public/ assets — images, video,
     *   fonts, PDFs, etc. — and Next's own metadata files like
     *   favicon.ico/opengraph-image.png). Deliberately an extension-agnostic
     *   rule instead of a whitelist: a new public asset type should never
     *   have to be added here to avoid getting redirected to /auth/login.
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|.*\\..*).*)",
  ],
};
