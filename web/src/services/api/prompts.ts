import { compactApiParams, serializeApiParams } from "@/services/api/request";

export type Prompt = {
    id: string;
    title: string;
    coverUrl: string;
    prompt: string;
    tags: string[];
    category: string;
    githubUrl: string;
    preview: string;
    createdAt: string;
    updatedAt: string;
};

export const ALL_PROMPTS_OPTION = "全部";

export type PromptListResponse = {
    items: Prompt[];
    tags: string[];
    categories: string[];
    fetchedAt: number;
    sourceCount: number;
    total: number;
    totalAll: number;
    totalChinese: number;
};

export async function fetchPrompts({ keyword = "", tag = [], category = ALL_PROMPTS_OPTION, page, pageSize, random, coverOnly, language }: { keyword?: string; tag?: string[]; category?: string; page?: number; pageSize?: number; random?: boolean; coverOnly?: boolean; language?: "zh" } = {}) {
    const params = serializeApiParams(
        compactApiParams({
            ...(keyword ? { keyword } : {}),
            ...(tag.length ? { tag } : {}),
            ...(category !== ALL_PROMPTS_OPTION ? { category } : {}),
            ...(page ? { page } : {}),
            ...(pageSize ? { pageSize } : {}),
            ...(random ? { random: 1 } : {}),
            ...(coverOnly ? { coverOnly: 1 } : {}),
            ...(language ? { language } : {}),
        }),
    );
    const response = await fetch(`/api/prompts${params.size ? `?${params}` : ""}`);
    if (!response.ok) throw new Error("获取提示词失败");
    return (await response.json()) as PromptListResponse;
}

export function formatPromptDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function formatPromptDateTime(value?: number) {
    if (!value) return "暂无";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "暂无" : new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}
