import { NextRequest, NextResponse } from "next/server";

import { AuthInputError, createSessionToken, getPublicAuthConfig, readRequestSession, sessionCookieOptions, updateCurrentUser } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
    const session = readRequestSession(request);
    if (!session) return NextResponse.json({ code: 401, data: null, msg: "请先登录" }, { status: 401 });

    const body = (await request.json().catch(() => null)) as { username?: string; displayName?: string; currentPassword?: string; newPassword?: string } | null;
    try {
        const user = updateCurrentUser(session.user.id, body || {});
        const response = NextResponse.json({ code: 0, data: { user, ...getPublicAuthConfig() }, msg: "账号配置已更新" });
        response.cookies.set({ ...sessionCookieOptions(), value: createSessionToken(user) });
        return response;
    } catch (error) {
        const status = error instanceof AuthInputError ? error.status : 500;
        const msg = error instanceof Error ? error.message : "账号配置更新失败";
        return NextResponse.json({ code: status, data: null, msg }, { status });
    }
}
