import { NextResponse, type NextRequest } from "next/server";

import { getAppConfig, readRequestSession } from "@/lib/auth/config";

const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/register", "/api/auth/session"];

export function proxy(request: NextRequest) {
    const config = getAppConfig();
    if (!config.auth.enabled) return NextResponse.next();

    const { pathname, search } = request.nextUrl;
    const isPublic = publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    const session = readRequestSession(request);

    if (pathname === "/login" && session) return NextResponse.redirect(new URL("/", request.url));
    if (isPublic || session) return NextResponse.next();

    if (pathname.startsWith("/api/") || pathname === "/webdav-proxy") {
        return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|logo.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
