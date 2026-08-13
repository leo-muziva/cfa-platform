import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";
import { getSupabasePublicConfig } from "./config";

export async function updateSession(request: NextRequest) {
  let authCookiesToClear: string[] = [];
  let supabaseResponse = NextResponse.next({
    request,
  });

  // If the env vars are not set, skip proxy check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const config = getSupabasePublicConfig();

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Validate the session against Auth. A signed token may refer to a user
  // deleted by a local database reset, so claims alone are not authoritative.
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    const staleAuthCookies = request.cookies
      .getAll()
      .filter(({ name }) => name.startsWith("sb-") && name.includes("-auth-token"));

    authCookiesToClear = staleAuthCookies.map(({ name }) => name);
    staleAuthCookies.forEach(({ name }) => request.cookies.delete(name));
    supabaseResponse = NextResponse.next({ request });
    staleAuthCookies.forEach(({ name }) => supabaseResponse.cookies.delete(name));
  }

  const publicPrefixes = [
    "/", "/book", "/classes", "/membership", "/membership-portal", "/family", "/about", "/contact", "/privacy", "/terms", "/auth"
  ];
  const isPublicRoute = publicPrefixes.some((prefix) =>
    prefix === "/" ? request.nextUrl.pathname === "/" : request.nextUrl.pathname.startsWith(prefix)
  );

  if (
    !isPublicRoute &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(url);
    authCookiesToClear.forEach((name) => redirectResponse.cookies.delete(name));
    return redirectResponse;
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
