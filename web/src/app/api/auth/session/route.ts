import { NextRequest, NextResponse } from "next/server";

import { getPublicAuthConfig, readRequestSession } from "@/lib/auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const session = readRequestSession(request);
    return NextResponse.json({ code: 0, data: { user: session?.user || null, ...getPublicAuthConfig() }, msg: "OK" });
}
