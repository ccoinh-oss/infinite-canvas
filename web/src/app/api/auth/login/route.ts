import { NextRequest, NextResponse } from "next/server";

import { authenticateUser, createSessionToken, getAppConfig, getPublicAuthConfig, sessionCookieOptions } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const config = getAppConfig();
    if (!config.auth.enabled) return NextResponse.json({ code: 0, data: { user: null, ...getPublicAuthConfig() }, msg: "登录准入未启用" });

    const body = (await request.json().catch(() => null)) as { username?: string; password?: string } | null;
    const user = authenticateUser(body?.username || "", body?.password || "");
    if (!user) return NextResponse.json({ code: 401, data: null, msg: "用户名或密码不正确" }, { status: 401 });

    const response = NextResponse.json({ code: 0, data: { user, ...getPublicAuthConfig() }, msg: "登录成功" });
    response.cookies.set({ ...sessionCookieOptions(), value: createSessionToken(user) });
    return response;
}
