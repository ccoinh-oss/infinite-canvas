import { NextResponse, type NextRequest } from "next/server";

import { getPromptCacheOptions, readPromptCache } from "@/lib/prompts/prompt-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const options = getPromptCacheOptions();
    const cache = readPromptCache(options);
    return NextResponse.json({
        code: 0,
        data: {
            enabled: options.enabled,
            path: options.path,
            ttlMs: options.ttlMs,
            exists: Boolean(cache),
            updatedAt: cache?.updatedAt || 0,
            total: cache?.items.length || 0,
            stats: cache?.stats || null,
            sources: cache?.sources || {},
        },
        msg: "OK",
    });
}

export async function POST(request: NextRequest) {
    const url = new URL("/api/prompts", request.url);
    url.searchParams.set("pageSize", "1");
    url.searchParams.set("refresh", "1");
    const cookie = request.headers.get("cookie");
    const response = await fetch(url, { headers: cookie ? { cookie } : undefined, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ code: response.status, data: null, msg: "提示词缓存刷新失败" }, { status: response.status });
    const data = await response.json();
    return NextResponse.json({ code: 0, data: data.cache, msg: "提示词缓存已刷新" });
}
