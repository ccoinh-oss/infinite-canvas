import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiProxyRequest = {
    baseUrl?: string;
    apiKey?: string;
    apiFormat?: "openai" | "gemini";
    path?: string;
    method?: string;
    contentType?: string;
    body?: unknown;
};

export async function POST(request: NextRequest) {
    const payload = (await request.json().catch(() => null)) as AiProxyRequest | null;
    const baseUrl = normalizeBaseUrl(payload?.baseUrl || "");
    const apiKey = (payload?.apiKey || "").trim();
    const path = payload?.path || "";
    const method = (payload?.method || "POST").toUpperCase();
    if (!baseUrl || !apiKey) return NextResponse.json({ code: 400, data: null, msg: "请先填写 Base URL 和 API Key" }, { status: 400 });
    if (!path.startsWith("/")) return NextResponse.json({ code: 400, data: null, msg: "代理路径不正确" }, { status: 400 });

    const requestBody = encodeBody(payload);
    const upstream = await fetch(buildApiUrl(baseUrl, path), {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(payload?.contentType && !isFormDataBody(payload) ? { "Content-Type": payload.contentType } : {}),
        },
        body: method === "GET" ? undefined : requestBody,
        cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const responseBody = await upstream.arrayBuffer();
    return new NextResponse(responseBody, { status: upstream.status, headers: { "content-type": contentType } });
}

function encodeBody(payload: AiProxyRequest | null) {
    if (!payload?.body) return undefined;
    if (isFormDataBody(payload)) return buildFormData(payload.body);
    return JSON.stringify(payload.body);
}

function isFormDataBody(payload: AiProxyRequest | null) {
    return Boolean(payload?.contentType?.startsWith("multipart/form-data"));
}

function buildFormData(body: unknown) {
    const formData = new FormData();
    const fields = isRecord(body) && isRecord(body.fields) ? body.fields : {};
    Object.entries(fields).forEach(([key, value]) => formData.append(key, String(value)));
    const files = isRecord(body) && Array.isArray(body.files) ? body.files : [];
    files.forEach((file) => {
        if (!isRecord(file) || typeof file.field !== "string" || typeof file.dataUrl !== "string") return;
        formData.append(file.field, dataUrlToFile(file.dataUrl, typeof file.name === "string" ? file.name : "reference.png", typeof file.type === "string" ? file.type : undefined));
    });
    return formData;
}

function dataUrlToFile(dataUrl: string, name: string, fallbackType?: string) {
    const [header, content = ""] = dataUrl.split(",", 2);
    const mimeType = header.match(/data:(.*?);base64/)?.[1] || fallbackType || "image/png";
    const bytes = Uint8Array.from(Buffer.from(content, "base64"));
    return new File([bytes], name, { type: mimeType });
}

function buildApiUrl(baseUrl: string, path: string) {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") || lowerBaseUrl.endsWith("/api/v3") || lowerBaseUrl.endsWith("/api/plan/v3") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
