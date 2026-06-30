import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiCallFormat = "openai" | "gemini";

type ModelsRequest = {
    baseUrl?: string;
    apiKey?: string;
    apiFormat?: ApiCallFormat;
};

type ModelListPayload = {
    data?: Array<{ id?: string }>;
    models?: Array<{ name?: string }>;
    error?: { message?: string };
    msg?: string;
};

export async function POST(request: NextRequest) {
    const body = (await request.json().catch(() => null)) as ModelsRequest | null;
    const baseUrl = normalizeBaseUrl(body?.baseUrl || "");
    const apiKey = (body?.apiKey || "").trim();
    const apiFormat = body?.apiFormat === "gemini" ? "gemini" : "openai";
    if (!baseUrl || !apiKey) return NextResponse.json({ code: 400, data: null, msg: "请先填写 Base URL 和 API Key" }, { status: 400 });

    const url = apiFormat === "gemini" ? geminiModelsUrl(baseUrl) : openAiModelsUrl(baseUrl);
    const response = await fetch(url, {
        headers: apiFormat === "gemini" ? { "x-goog-api-key": apiKey } : { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as ModelListPayload | null;
    if (!response.ok) return NextResponse.json({ code: response.status, data: null, msg: readModelError(payload, response.status) }, { status: response.status });
    if (!payload) return NextResponse.json({ code: 502, data: null, msg: "模型接口没有返回 JSON，请检查 Base URL 是否为 API 地址" }, { status: 502 });

    const models = apiFormat === "gemini" ? (payload.models || []).map((model) => model.name?.replace(/^models\//, "")) : (payload.data || []).map((model) => model.id);
    return NextResponse.json({ code: 0, data: Array.from(new Set(models.filter((id): id is string => Boolean(id)))).sort((a, b) => a.localeCompare(b)), msg: "OK" });
}

function openAiModelsUrl(baseUrl: string) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}/models`;
}

function geminiModelsUrl(baseUrl: string) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/v1beta") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1beta`;
    return `${apiBaseUrl}/models`;
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

function readModelError(payload: ModelListPayload | null, status: number) {
    if (payload?.msg) return payload.msg;
    if (payload?.error?.message) return payload.error.message;
    if (status === 401 || status === 403) return "鉴权失败，请检查 API Key、套餐权限或模型权限";
    if (status === 429) return "请求被限流或额度不足，请稍后重试";
    return `读取模型失败：${status}`;
}
