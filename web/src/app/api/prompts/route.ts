import type { NextRequest } from "next/server";

import { collectPromptTags, getPromptCacheOptions, hasChinesePromptText, isPromptCacheFresh, mergePromptCache, queryPromptItems, readPromptCache, writePromptCache, type Prompt, type PromptCacheFile, type PromptSourceLoadResult } from "@/lib/prompts/prompt-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PromptCategory = {
    category: string;
    githubUrl: string;
    build: () => Promise<Omit<Prompt, "category" | "githubUrl">[]>;
};

const awesomeGptImageRawBase = "https://raw.githubusercontent.com/ZeroLu/awesome-gpt-image/main";
const awesomeGpt4oImagePromptsBase = "https://raw.githubusercontent.com/ImgEdify/Awesome-GPT4o-Image-Prompts/main";
const youMindGptImage2RawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main";
const youMindNanoBananaProRawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main";
const davidWuGptImage2RawBase = "https://raw.githubusercontent.com/davidwuw0811-boop/awesome-gpt-image2-prompts/main";
const songtianlunRawBase = "https://raw.githubusercontent.com/songtianlun/awesome-prompts/main";
const danielGptImage2DigestRawBase = "https://raw.githubusercontent.com/Danielhan626/best-gpt-image-2-prompts-digest/main";
const youMindAiImageSkillRawBase = "https://raw.githubusercontent.com/YouMind-OpenLab/ai-image-prompts-skill/main";

const categories: PromptCategory[] = [
    { category: "awesome-gpt-image", githubUrl: "https://github.com/ZeroLu/awesome-gpt-image", build: buildAwesomeGptImagePrompts },
    { category: "awesome-gpt4o-image-prompts", githubUrl: "https://github.com/ImgEdify/Awesome-GPT4o-Image-Prompts", build: buildAwesomeGpt4oImagePrompts },
    { category: "youmind-gpt-image-2", githubUrl: "https://github.com/YouMind-OpenLab/awesome-gpt-image-2", build: () => buildYouMindPrompts(youMindGptImage2RawBase, "youmind-gpt-image-2", "gpt-image-2") },
    { category: "youmind-nano-banana-pro", githubUrl: "https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts", build: () => buildYouMindPrompts(youMindNanoBananaProRawBase, "youmind-nano-banana-pro", "nano-banana-pro") },
    { category: "davidwu-gpt-image2-prompts", githubUrl: "https://github.com/davidwuw0811-boop/awesome-gpt-image2-prompts", build: buildDavidWuGptImage2Prompts },
    { category: "songtianlun-awesome-prompts", githubUrl: "https://github.com/songtianlun/awesome-prompts", build: buildSongtianlunPrompts },
    { category: "danielhan-gpt-image-2-digest", githubUrl: "https://github.com/Danielhan626/best-gpt-image-2-prompts-digest", build: buildDanielGptImage2DigestPrompts },
    { category: "youmind-ai-image-prompts-skill", githubUrl: "https://github.com/YouMind-OpenLab/ai-image-prompts-skill", build: buildYouMindAiImageSkillPrompts },
];

let memoryCache: PromptCacheFile | null = null;
let loadingPrompts: Promise<PromptCacheFile> | null = null;

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const keyword = (params.get("keyword") || "").trim().toLowerCase();
    const tags = params.getAll("tag").filter(Boolean);
    const category = params.get("category") || "";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(params.get("pageSize")) || 20));
    const random = params.get("random") === "1";
    const coverOnly = params.get("coverOnly") === "1";
    const language = params.get("language") || "";
    const forceRefresh = params.get("refresh") === "1";
    const { cache, source } = await getPromptCache(forceRefresh);
    const options = getPromptCacheOptions();
    const items = cache.items;
    const withoutTagFilter = queryPromptItems(items, { keyword, category, language, pageSize: 100 }).allItems;
    const result = queryPromptItems(items, { keyword, category, tags, page, pageSize, random, coverOnly, language });

    return Response.json({
        items: result.items,
        tags: collectPromptTags(withoutTagFilter),
        categories: categories.map((item) => item.category),
        fetchedAt: cache.updatedAt,
        sourceCount: categories.length,
        total: result.total,
        totalAll: items.length,
        totalChinese: items.filter(hasChinesePromptText).length,
        cache: {
            enabled: options.enabled,
            source,
            ttlMs: options.ttlMs,
            stats: cache.stats,
            sources: cache.sources,
        },
    });
}

async function getPromptCache(forceRefresh: boolean) {
    const options = getPromptCacheOptions();
    if (!forceRefresh && memoryCache && isPromptCacheFresh(memoryCache, options)) return { cache: memoryCache, source: "memory" as const };
    const diskCache = readPromptCache(options);
    if (!forceRefresh && diskCache && isPromptCacheFresh(diskCache, options)) {
        memoryCache = diskCache;
        return { cache: diskCache, source: "disk" as const };
    }
    if (loadingPrompts) return { cache: await loadingPrompts, source: "refresh" as const };
    loadingPrompts = refreshPromptCache(diskCache || memoryCache).finally(() => {
        loadingPrompts = null;
    });
    return { cache: await loadingPrompts, source: "refresh" as const };
}

async function refreshPromptCache(previous: PromptCacheFile | null) {
    const sources = await Promise.all(
        categories.map(async (category) => {
            try {
                const items = await category.build();
                return { category: category.category, githubUrl: category.githubUrl, ok: true, items: items.map((item) => ({ ...item, category: category.category, githubUrl: category.githubUrl })) } satisfies PromptSourceLoadResult;
            } catch (error) {
                return { category: category.category, githubUrl: category.githubUrl, ok: false, items: [], error: error instanceof Error ? error.message : "加载失败" } satisfies PromptSourceLoadResult;
            }
        }),
    );
    const cache = mergePromptCache(previous, sources);
    memoryCache = cache;
    writePromptCache(cache);
    return cache;
}

async function buildAwesomeGptImagePrompts() {
    const markdown = await fetchText(awesomeGptImageRawBase, "README.zh-CN.md");
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const section of splitBeforeHeading(markdown, "## ")) {
        const tags = tagsFromHeading(firstMatch(section, /^##\s+(.+)$/m));
        for (const block of splitBeforeHeading(section, "### ")) {
            const title = firstMatch(block, /^###\s+(.+)$/m).replace(/\[([^\]]+)]\([^)]+\)/g, "$1").trim();
            const prompt = firstMatch(block, /\*\*提示词:\*\*\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
            if (!title || !prompt) continue;
            const images = promptImages(awesomeGptImageRawBase, block);
            items.push(defaultPrompt(`awesome-gpt-image-${leftPad(items.length + 1)}`, title, prompt, images[0] || "", tags, markdownPreview(images)));
        }
    }
    return items;
}

async function buildAwesomeGpt4oImagePrompts() {
    const markdown = await fetchText(awesomeGpt4oImagePromptsBase, "README.zh-CN.md");
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+(.+)$/m).trim();
        const prompt = firstMatch(block, /- \*\*提示词文本：\*\*\s*`(.*?)`/s).trim();
        if (!title || !prompt) continue;
        const images = promptImages(awesomeGpt4oImagePromptsBase, block);
        items.push(defaultPrompt(`awesome-gpt4o-image-prompts-${leftPad(items.length + 1)}`, title, prompt, images[0] || "", ["gpt4o"], markdownPreview(images)));
    }
    return items;
}

async function buildYouMindPrompts(baseUrl: string, idPrefix: string, modelTag: string) {
    const markdown = await fetchText(baseUrl, "README_zh.md");
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const title = firstMatch(block, /^###\s+No\.\s*\d+:\s*(.+)$/m).trim();
        const prompt = firstMatch(block, /#### .*?提示词\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
        if (!title || !prompt) continue;
        const images = promptImages(baseUrl, block);
        items.push(defaultPrompt(`${idPrefix}-${leftPad(items.length + 1)}`, title, prompt, images[0] || "", youMindTags(title, modelTag), markdownPreview(images)));
    }
    return items;
}

async function buildDavidWuGptImage2Prompts() {
    const data = await fetchJson<Array<{ id?: number; title_en?: string; title_cn?: string; category?: string; category_cn?: string; prompt?: string; note?: string; author?: string; source?: string; needs_ref?: boolean; image?: string }>>(davidWuGptImage2RawBase, "prompts.json");
    return data
        .map((item, index) => {
            const title = (item.title_cn || item.title_en || "").trim();
            const prompt = (item.prompt || "").trim();
            if (!title || !prompt) return null;
            const image = normalizePromptImage(davidWuGptImage2RawBase, item.image || "");
            const preview = [item.title_en, item.note, image ? `![](${image})` : ""].filter(Boolean).join("\n\n");
            return defaultPrompt(`davidwu-gpt-image2-prompts-${leftPad(item.id || index + 1)}`, title, prompt, image, davidWuTags(item), preview);
        })
        .filter((item): item is Omit<Prompt, "category" | "githubUrl"> => Boolean(item));
}

async function buildSongtianlunPrompts() {
    const files = [
        { file: "docs/text-to-image/gpt/gpt-image-1.md", tags: ["gpt-image-1"], imageBase: `${songtianlunRawBase}/docs` },
        { file: "docs/text-to-image/gpt/awesome-gpt4o-images.md", tags: ["gpt-4o"], imageBase: `${songtianlunRawBase}/docs` },
        { file: "docs/text-to-image/nano-banana/awesome-nano-banana-images.md", tags: ["nano-banana"], imageBase: `${songtianlunRawBase}/docs` },
        { file: "docs/text-to-image/nano-banana/awesome-nano-banana-pro-images.md", tags: ["nano-banana-pro"], imageBase: `${songtianlunRawBase}/docs` },
    ];
    const markdowns = await Promise.all(files.map((entry) => fetchText(songtianlunRawBase, entry.file)));
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    markdowns.forEach((markdown, index) => {
        const entry = files[index];
        for (const block of splitBeforeHeading(markdown, "### ")) {
            const title = firstMatch(block, /^###\s+(.+)$/m).replace(/\[([^\]]+)]\([^)]+\)/g, "$1").trim();
            const prompt = firstMatch(block, /\*\*(?:\u63d0\u793a\u8bcd|Prompt)[:\uff1a]?\*\*\s*\r?\n\s*```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
            if (!title || !prompt) continue;
            const images = promptImages(entry.imageBase, block);
            if (!images.length) continue;
            const coverUrl = images.find((image) => /\/output\.(?:png|jpe?g|webp|gif)(?:\?|$)/i.test(image)) || images[0];
            items.push(defaultPrompt(`songtianlun-${leftPad(items.length + 1)}`, title, prompt, coverUrl, entry.tags, markdownPreview(images)));
        }
    });
    return items;
}

async function buildDanielGptImage2DigestPrompts() {
    const markdown = await fetchText(danielGptImage2DigestRawBase, "source/README_zh-CN.md");
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    let activeCategory = "";
    for (const block of splitBeforeHeading(markdown, "### ")) {
        const nextCategory = firstMatch(block, /^##\s+(.+)$/m).trim();
        if (nextCategory && !/(?:prompt|\u63d0\u793a\u8bcd)/i.test(nextCategory)) activeCategory = nextCategory;
        const heading = firstMatch(block, /^###\s+(.+)$/m).trim();
        if (!heading) continue;
        if (!/^Case\s+\d+:/i.test(heading)) continue;
        const [, caseNumber, title] = heading.match(/^Case\s+(\d+):\s*(.+)$/i) || [];
        const prompt = firstMatch(block, /```[\w-]*\r?\n(.*?)\r?\n```/s).trim();
        if (!caseNumber || !title || !prompt) continue;
        const images = promptImages(`${danielGptImage2DigestRawBase}/source`, block);
        const coverUrl = images[0] || "";
        const sourceUrl = firstMatch(block, /^###\s+Case\s+\d+:\s+\[[^\]]+]\(([^)]+)\)/m);
        const author = firstMatch(block, /\[@([^\]]+)]/);
        const preview = [author ? `Author: ${author}` : "", sourceUrl ? `[Source](${sourceUrl})` : "", markdownPreview(images)].filter(Boolean).join("\n\n");
        items.push(defaultPrompt(`danielhan-gpt-image-2-digest-${leftPad(Number(caseNumber))}`, cleanDanielGptImage2Title(title), prompt, coverUrl, danielGptImage2Tags(activeCategory, author), preview));
    }
    return items;
}

type YouMindAiImageSkillManifest = {
    updatedAt?: string;
    categories?: Array<{ slug?: string; title?: string; file?: string; count?: number }>;
};

type YouMindAiImageSkillItem = {
    id?: number | string;
    content?: string;
    title?: string;
    description?: string;
    sourceMedia?: string[];
    needReferenceImages?: boolean;
};

async function buildYouMindAiImageSkillPrompts() {
    const manifest = await fetchJson<YouMindAiImageSkillManifest>(youMindAiImageSkillRawBase, "references/manifest.json");
    const categories = (manifest.categories || []).filter((item) => item.slug && item.file);
    const data = await Promise.all(
        categories.map(async (category) => ({
            category,
            items: await fetchJson<YouMindAiImageSkillItem[]>(youMindAiImageSkillRawBase, `references/${category.file}`),
        })),
    );
    const seen = new Set<string>();
    const items: Omit<Prompt, "category" | "githubUrl">[] = [];
    data.forEach(({ category, items: categoryItems }) => {
        categoryItems.forEach((item, index) => {
            const title = (item.title || "").trim();
            const prompt = (item.content || "").trim();
            if (!title || !prompt) return;
            const uniqueKey = String(item.id || prompt);
            if (seen.has(uniqueKey)) return;
            seen.add(uniqueKey);
            const images = (item.sourceMedia || []).map((image) => normalizePromptImage(youMindAiImageSkillRawBase, image)).filter(Boolean);
            const tags = [category.title || category.slug || "", item.needReferenceImages ? "需要参考图" : ""].filter(Boolean);
            const preview = [item.description, markdownPreview(images)].filter(Boolean).join("\n\n");
            items.push(defaultPrompt(`youmind-ai-image-prompts-skill-${category.slug}-${leftPad(Number(item.id) || index + 1)}`, title, prompt, images[0] || "", tags, preview));
        });
    });
    return items;
}

function cleanDanielGptImage2Title(title: string) {
    return title.replace(/\[([^\]]+)]\([^)]+\)/g, "$1").replace(/\s*(?:\((?:\u4f5c\u8005|Author)[^)]+\)|\uff08(?:\u4f5c\u8005|Author)[^\uff09]+\uff09)\s*$/i, "").trim();
}

function danielGptImage2Tags(category: string, author: string) {
    return splitTags([category, author, "gpt-image-2"].filter(Boolean).join("/"), /\//);
}

function defaultPrompt(id: string, title: string, prompt: string, coverUrl: string, tags: string[], preview: string): Omit<Prompt, "category" | "githubUrl"> {
    return { id, title, coverUrl, prompt, tags, preview, createdAt: "", updatedAt: "" };
}

async function fetchText(baseUrl: string, file: string) {
    const response = await fetch(`${baseUrl}/${file}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`${file} 拉取失败`);
    return response.text();
}

async function fetchJson<T>(baseUrl: string, file: string) {
    return JSON.parse(await fetchText(baseUrl, file)) as T;
}

function splitBeforeHeading(markdown: string, prefix: string) {
    const blocks: string[] = [];
    let current: string[] = [];
    for (const line of markdown.split("\n")) {
        if (line.startsWith(prefix) && current.length) {
            blocks.push(current.join("\n"));
            current = [];
        }
        current.push(line);
    }
    blocks.push(current.join("\n"));
    return blocks;
}

function firstMatch(value: string, pattern: RegExp) {
    return pattern.exec(value)?.[1] || "";
}

function promptImages(baseUrl: string, markdown: string) {
    return Array.from(new Set([...extractHtmlImages(baseUrl, markdown), ...extractMarkdownImages(baseUrl, markdown)].filter(Boolean)));
}

function extractMarkdownImages(baseUrl: string, markdown: string) {
    return Array.from(markdown.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g), (match) => normalizePromptImage(baseUrl, match[2], match[1])).filter(Boolean);
}

function extractHtmlImages(baseUrl: string, markdown: string) {
    return Array.from(markdown.matchAll(/<img\s+[^>]*src=(?:"([^"]+)"|'([^']+)')[^>]*>/gi), (match) => {
        const tag = match[0];
        const altMatch = /alt=(?:"([^"]*)"|'([^']*)')/i.exec(tag);
        const alt = altMatch?.[1] || altMatch?.[2] || "";
        return normalizePromptImage(baseUrl, match[1] || match[2] || "", alt);
    }).filter(Boolean);
}

function normalizePromptImage(baseUrl: string, image: string, alt = "") {
    const url = absoluteImage(baseUrl, image.trim());
    if (!url) return "";
    return isPromptPreviewImage(url, alt) ? url : "";
}

function isPromptPreviewImage(url: string, alt = "") {
    const value = `${url} ${alt}`.toLowerCase();
    if (/img\.shields\.io|awesome\.re\/badge|github\.com\/.+\/actions\/workflows\/.+\/badge|api\.star-history\.com/.test(value)) return false;
    if (/marketing-assets\.youmind\.com\/campaigns|prompts-cover|og-hq/.test(value)) return false;
    if (/best-gpt-image-2-prompts-digest\/main\/source\/images\//.test(value)) return false;
    if (/pbs\.twimg\.com\/media\/g7nret(?:gawaafo6z|yayaajpjd)/.test(value)) return false;
    if (/awesome-nano-banana-pro-images\/case-\d+\/input\.(?:png|jpe?g|webp)(?:\?|$)/.test(value)) return false;
    if (/language-|license|stars|prs welcome|update readme|cover/.test(alt.toLowerCase())) return false;
    return true;
}

function absoluteImage(baseUrl: string, image: string) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    const normalizedBase = baseUrl.replace(/\/$/, "");
    const normalizedImage = image.startsWith("/") ? image.slice(1) : image.replace(/^\.?\//, "");
    return `${normalizedBase}/${normalizedImage}`;
}

function tagsFromCategory(category: string) {
    return splitTags(category.replace(/\s+Cases$/i, ""), /\s*(?:&|and)\s*/);
}

function tagsFromHeading(heading: string) {
    return splitTags(heading.replace(/[^\p{L}\p{N}/&、与 ]/gu, ""), /\s*(?:\/|&|、|与)\s*/);
}

function youMindTags(title: string, modelTag: string) {
    const [, prefix] = title.match(/^(.+?) - /) || [];
    return [modelTag, ...tagsFromHeading(prefix || "")];
}

function davidWuTags(item: { category_cn?: string; category?: string; author?: string; source?: string; needs_ref?: boolean }) {
    const tags = splitTags([item.category_cn, item.category, item.author, item.source].filter(Boolean).join("/"), /\//);
    if (item.needs_ref) tags.push("需要参考图");
    return tags;
}

function splitTags(value: string, pattern: RegExp) {
    return value
        .split(pattern)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);
}

function markdownPreview(images: string[]) {
    return images.filter(Boolean).map((image) => `![](${image})`).join("\n\n");
}

function leftPad(value: number) {
    return String(value).padStart(4, "0");
}
