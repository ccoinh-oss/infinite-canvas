import { NextRequest, NextResponse } from "next/server";

import { AuthInputError, createSessionToken, getAppConfig, getPublicAuthConfig, registerUser, sessionCookieOptions } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    const config = getAppConfig();
    if (!config.auth.enabled) return NextResponse.json({ code: 0, data: { user: null, ...getPublicAuthConfig() }, msg: "登录准入未启用" });

    const body = (await request.json().catch(() => null)) as { username?: string; password?: string; displayName?: string } | null;
    try {
        const user = registerUser({ username: body?.username || "", password: body?.password || "", displayName: body?.displayName });
        const response = NextResponse.json({ code: 0, data: { user, ...getPublicAuthConfig() }, msg: "注册成功" });
        response.cookies.set({ ...sessionCookieOptions(), value: createSessionToken(user) });
        return response;
    } catch (error) {
        const status = error instanceof AuthInputError ? error.status : 500;
        const msg = error instanceof Error ? error.message : "注册失败";
        return NextResponse.json({ code: status, data: null, msg }, { status });
    }
}
