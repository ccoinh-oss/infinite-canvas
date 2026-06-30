import { NextResponse } from "next/server";

import { sessionCookieOptions } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    const response = NextResponse.json({ code: 0, data: null, msg: "已退出登录" });
    response.cookies.set({ ...sessionCookieOptions(), value: "", maxAge: 0 });
    return response;
}
