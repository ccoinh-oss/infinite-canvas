import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { load } from "js-yaml";

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

export type PromptSourceLoadResult = {
    category: string;
    githubUrl: string;
    ok: boolean;
    items: Prompt[];
    error?: string;
};

export type PromptCacheFile = {
    version: 1;
    updatedAt: number;
    sources: Record<string, { githubUrl: string; ok: boolean; itemCount: number; error?: string; updatedAt: number }>;
    stats: { added: number; updated: number; deleted: number; unchanged: number; total: number };
    items: Prompt[];
};

export type PromptCacheOptions = {
    enabled: boolean;
    path: string;
    ttlMs: number;
};

type RawPromptCacheConfig = {
    prompts?: {
        cache?: {
            enabled?: unknown;
            path?: unknown;
            ttl_seconds?: unknown;
        };
    };
};

const configPathCandidates = [resolve(process.cwd(), "../config/app.yaml"), resolve(process.cwd(), "config/app.yaml"), resolve(process.cwd(), "../../../config/app.yaml")];
let cachedOptions: PromptCacheOptions | null = null;

export function getPromptCacheOptions() {
    if (cachedOptions) return cachedOptions;
    const configPath = configPathCandidates.find((path) => existsSync(path));
    const rootDir = configPath ? resolve(dirname(configPath), "..") : resolve(process.cwd(), "..");
    const raw = configPath ? (load(readFileSync(configPath, "utf8").replace(/^\uFEFF/, "")) as RawPromptCacheConfig) : {};
    const cache = raw.prompts?.cache || {};
    cachedOptions = {
        enabled: cache.enabled !== false,
        path: resolve(rootDir, stringOr(cache.path, "data/prompts-cache.json")),
        ttlMs: numberOr(cache.ttl_seconds, 3600) * 1000,
    };
    return cachedOptions;
}

export function readPromptCache(options = getPromptCacheOptions()) {
    if (!options.enabled || !existsSync(options.path)) return null;
    try {
        const cache = JSON.parse(readFileSync(options.path, "utf8")) as PromptCacheFile;
        if (cache.version !== 1 || !Array.isArray(cache.items)) return null;
        return cache;
    } catch {
        return null;
    }
}

export function writePromptCache(cache: PromptCacheFile, options = getPromptCacheOptions()) {
    if (!options.enabled) return;
    mkdirSync(dirname(options.path), { recursive: true });
    const tempPath = `${options.path}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
    renameSync(tempPath, options.path);
}

export function isPromptCacheFresh(cache: PromptCacheFile | null, options = getPromptCacheOptions(), now = Date.now()) {
    return Boolean(cache && now - cache.updatedAt < options.ttlMs);
}

export function mergePromptCache(previous: PromptCacheFile | null, sources: PromptSourceLoadResult[], now = Date.now()): PromptCacheFile {
    const nowIso = new Date(now).toISOString();
    const previousItems = previous?.items || [];
    const sourceGroups = sources.map((source) => ({
        source,
        items: source.ok ? source.items.map((item) => normalizePrompt({ ...item, category: source.category, githubUrl: source.githubUrl })) : [],
    }));
    const duplicateBases = findDuplicatePromptBases([previousItems, ...sourceGroups.map((group) => group.items)]);
    const previousByKey = new Map<string, Prompt>();
    previousItems.forEach((item) => previousByKey.set(promptCacheKey(item, duplicateBases), item));

    const nextItems: Prompt[] = [];
    const nextKeys = new Set<string>();
    const sourceCategories = new Set(sources.map((source) => source.category));
    const successfulCategories = new Set(sources.filter((source) => source.ok).map((source) => source.category));
    const failedCategories = new Set(sources.filter((source) => !source.ok).map((source) => source.category));
    const stats = { added: 0, updated: 0, deleted: 0, unchanged: 0, total: 0 };

    for (const group of sourceGroups) {
        if (!group.source.ok) continue;
        for (const normalized of group.items) {
            const key = promptCacheKey(normalized, duplicateBases);
            const previousItem = previousByKey.get(key);
            nextKeys.add(key);
            if (!previousItem) {
                stats.added += 1;
                nextItems.push({ ...normalized, createdAt: nowIso, updatedAt: nowIso });
            } else if (promptContentHash(previousItem) !== promptContentHash(normalized)) {
                stats.updated += 1;
                nextItems.push({ ...normalized, createdAt: previousItem.createdAt || nowIso, updatedAt: nowIso });
            } else {
                stats.unchanged += 1;
                nextItems.push({ ...normalized, createdAt: previousItem.createdAt, updatedAt: previousItem.updatedAt });
            }
        }
    }

    for (const item of previousItems) {
        const key = promptCacheKey(item, duplicateBases);
        if (failedCategories.has(item.category)) {
            stats.unchanged += 1;
            nextKeys.add(key);
            nextItems.push(item);
            continue;
        }
        if (successfulCategories.has(item.category) && !nextKeys.has(key)) {
            stats.deleted += 1;
            continue;
        }
        if (!sourceCategories.has(item.category)) {
            stats.deleted += 1;
        }
    }

    const sourcesState = Object.fromEntries(
        sources.map((source) => [
            source.category,
            {
                githubUrl: source.githubUrl,
                ok: source.ok,
                itemCount: source.ok ? source.items.length : previousItems.filter((item) => item.category === source.category).length,
                ...(source.error ? { error: source.error } : {}),
                updatedAt: now,
            },
        ]),
    );

    const items = nextItems.sort((left, right) => left.category.localeCompare(right.category) || left.id.localeCompare(right.id) || left.title.localeCompare(right.title));
    return { version: 1, updatedAt: now, sources: sourcesState, stats: { ...stats, total: items.length }, items };
}

export function queryPromptItems(
    items: Prompt[],
    options: {
        keyword?: string;
        category?: string;
        tags?: string[];
        language?: string;
        coverOnly?: boolean;
        random?: boolean;
        page?: number;
        pageSize?: number;
    },
) {
    const keyword = (options.keyword || "").trim().toLowerCase();
    const category = options.category || "";
    const tags = options.tags || [];
    const filtered = items.filter((item) => {
        if (isActiveOption(category) && item.category !== category) return false;
        if (tags.length && !tags.some((tag) => item.tags.includes(tag))) return false;
        if (options.language === "zh" && !hasChinesePromptText(item)) return false;
        if (options.coverOnly && !item.coverUrl) return false;
        if (!keyword) return true;
        return [item.title, item.prompt, item.category, item.preview, ...item.tags].join(" ").toLowerCase().includes(keyword);
    });
    const pageSize = Math.max(1, Math.min(100, Number(options.pageSize) || 20));
    const page = Math.max(1, Number(options.page) || 1);
    const pageItems = options.random ? shufflePrompts(filtered).slice(0, pageSize) : filtered.slice((page - 1) * pageSize, page * pageSize);
    return { items: pageItems, allItems: filtered, total: filtered.length };
}

export function collectPromptTags(items: Prompt[]) {
    return Array.from(new Set(items.flatMap((item) => item.tags).filter(Boolean)));
}

export function hasChinesePromptText(item: Prompt) {
    return /[\u4e00-\u9fff]/u.test(`${item.title}\n${item.prompt}\n${item.preview}`);
}

function normalizePrompt(item: Prompt): Prompt {
    return {
        id: String(item.id || "").trim(),
        title: item.title || "",
        coverUrl: item.coverUrl || "",
        prompt: item.prompt || "",
        tags: Array.from(new Set((item.tags || []).filter(Boolean))),
        category: item.category || "",
        githubUrl: item.githubUrl || "",
        preview: item.preview || "",
        createdAt: item.createdAt || "",
        updatedAt: item.updatedAt || "",
    };
}

function promptContentHash(item: Prompt) {
    return JSON.stringify({ title: item.title, coverUrl: item.coverUrl, prompt: item.prompt, tags: item.tags, category: item.category, githubUrl: item.githubUrl, preview: item.preview });
}

function findDuplicatePromptBases(collections: Prompt[][]) {
    const duplicated = new Set<string>();
    for (const items of collections) {
        const counts = new Map<string, number>();
        for (const item of items) {
            const base = promptBaseKey(item);
            counts.set(base, (counts.get(base) || 0) + 1);
        }
        for (const [base, count] of counts.entries()) {
            if (count > 1) duplicated.add(base);
        }
    }
    return duplicated;
}

function promptCacheKey(item: Prompt, duplicateBases: Set<string>) {
    const base = promptBaseKey(item);
    return duplicateBases.has(base) ? `${base}\u0000${item.title}` : base;
}

function promptBaseKey(item: Prompt) {
    const base = `${item.category}\u0000${item.id}`;
    return base;
}

function shufflePrompts(items: Prompt[]) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index--) {
        const target = Math.floor(Math.random() * (index + 1));
        [next[index], next[target]] = [next[target], next[index]];
    }
    return next;
}

function isActiveOption(value: string) {
    return value && value !== "全部" && value !== "all";
}

function stringOr(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOr(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}
