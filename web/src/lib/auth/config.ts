import { createHmac, pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { load } from "js-yaml";
import type { NextRequest } from "next/server";

export type AuthUser = {
    id: string;
    username: string;
    displayName: string;
};

type StoredAuthUser = AuthUser & {
    passwordHash: string;
    createdAt: string;
    updatedAt: string;
};

type AuthConfig = {
    enabled: boolean;
    registrationEnabled: boolean;
    cookieName: string;
    cookieSecure: boolean;
    sessionTtlSeconds: number;
    sessionSecret: string;
    localDataNotice: string;
    userStorePath: string;
};

type AppConfig = {
    app: { name: string };
    auth: AuthConfig;
};

type RawAppConfig = {
    app?: { name?: unknown };
    auth?: {
        enabled?: unknown;
        registration_enabled?: unknown;
        cookie_name?: unknown;
        cookie_secure?: unknown;
        session_ttl_seconds?: unknown;
        session_secret?: unknown;
        local_data_notice?: unknown;
        user_store_path?: unknown;
    };
};

type AuthUserStore = {
    users: StoredAuthUser[];
};

export type AuthSession = {
    user: AuthUser;
    expiresAt: number;
};

export type AccountUpdateInput = {
    username?: string;
    displayName?: string;
    currentPassword?: string;
    newPassword?: string;
};

const configPathCandidates = [resolve(process.cwd(), "../config/app.yaml"), resolve(process.cwd(), "config/app.yaml"), resolve(process.cwd(), "../../../config/app.yaml")];
let cachedConfig: AppConfig | null = null;

export function getAppConfig() {
    if (cachedConfig) return cachedConfig;
    const configPath = configPathCandidates.find((path) => existsSync(path));
    if (!configPath) throw new Error("未找到登录配置文件 config/app.yaml");
    const rawText = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
    const raw = load(rawText) as RawAppConfig;
    const auth = raw.auth || {};
    const rootDir = resolve(dirname(configPath), "..");
    cachedConfig = {
        app: { name: stringOr(raw.app?.name, "BMCCA无限画布") },
        auth: {
            enabled: auth.enabled !== false,
            registrationEnabled: auth.registration_enabled !== false,
            cookieName: stringOr(auth.cookie_name, "infinite_canvas_session"),
            cookieSecure: auth.cookie_secure === true,
            sessionTtlSeconds: numberOr(auth.session_ttl_seconds, 604800),
            sessionSecret: stringOr(auth.session_secret, ""),
            localDataNotice: stringOr(auth.local_data_notice, "画布、素材、生成记录和 AI API Key 仅保存在当前浏览器本地。"),
            userStorePath: resolve(rootDir, stringOr(auth.user_store_path, "data/auth-users.json")),
        },
    };
    return cachedConfig;
}

export function getPublicAuthConfig() {
    const config = getAppConfig();
    return {
        appName: config.app.name,
        authEnabled: config.auth.enabled,
        registrationEnabled: config.auth.registrationEnabled,
        localDataNotice: config.auth.localDataNotice,
    };
}

export function authenticateUser(username: string, password: string) {
    const normalizedUsername = normalizeUsername(username);
    const user = readUserStore().users.find((item) => item.username === normalizedUsername);
    if (!user || !verifyPassword(password, user.passwordHash)) return null;
    return publicUser(user);
}

export function registerUser(input: { username: string; password: string; displayName?: string }) {
    const config = getAppConfig();
    if (!config.auth.registrationEnabled) throw new AuthInputError("当前未开放注册");
    const username = normalizeUsername(input.username);
    const password = input.password || "";
    const displayName = normalizeDisplayName(input.displayName, username);
    validateUsername(username);
    validatePassword(password);

    const store = readUserStore();
    if (store.users.some((user) => user.username === username)) throw new AuthInputError("用户名已存在");
    const now = new Date().toISOString();
    const user: StoredAuthUser = { id: randomUUID(), username, displayName, passwordHash: hashPassword(password), createdAt: now, updatedAt: now };
    store.users.push(user);
    writeUserStore(store);
    return publicUser(user);
}

export function updateCurrentUser(userId: string, input: AccountUpdateInput) {
    const store = readUserStore();
    const user = store.users.find((item) => item.id === userId);
    if (!user) throw new AuthInputError("当前账号不存在", 404);

    const username = input.username === undefined ? user.username : normalizeUsername(input.username);
    const displayName = input.displayName === undefined ? user.displayName : normalizeDisplayName(input.displayName, username);
    const newPassword = input.newPassword || "";

    validateUsername(username);
    if (store.users.some((item) => item.id !== userId && item.username === username)) throw new AuthInputError("用户名已存在");
    if (newPassword) {
        if (!verifyPassword(input.currentPassword || "", user.passwordHash)) throw new AuthInputError("当前密码不正确", 401);
        validatePassword(newPassword);
        user.passwordHash = hashPassword(newPassword);
    }

    user.username = username;
    user.displayName = displayName;
    user.updatedAt = new Date().toISOString();
    writeUserStore(store);
    return publicUser(user);
}

export function createSessionToken(user: AuthUser) {
    const config = getAppConfig();
    const expiresAt = Date.now() + config.auth.sessionTtlSeconds * 1000;
    const payload = base64UrlEncode(JSON.stringify({ user, expiresAt } satisfies AuthSession));
    return `${payload}.${sign(payload, config.auth.sessionSecret)}`;
}

export function readSessionToken(token?: string): AuthSession | null {
    const config = getAppConfig();
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || signature !== sign(payload, config.auth.sessionSecret)) return null;
    try {
        const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;
        if (!session.user?.id || !session.user.username || Date.now() >= session.expiresAt) return null;
        return session;
    } catch {
        return null;
    }
}

export function readRequestSession(request: NextRequest) {
    const config = getAppConfig();
    if (!config.auth.enabled) return null;
    const session = readSessionToken(request.cookies.get(config.auth.cookieName)?.value);
    if (!session) return null;
    const user = readUserStore().users.find((item) => item.id === session.user.id);
    if (!user) return null;
    return { ...session, user: publicUser(user) };
}

export function sessionCookieOptions() {
    const config = getAppConfig();
    return {
        name: config.auth.cookieName,
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: config.auth.cookieSecure,
        maxAge: config.auth.sessionTtlSeconds,
    };
}

export class AuthInputError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.status = status;
    }
}

function readUserStore(): AuthUserStore {
    const path = getAppConfig().auth.userStorePath;
    if (!existsSync(path)) return { users: [] };
    try {
        const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AuthUserStore>;
        return {
            users: (raw.users || [])
                .map((user) => ({
                    id: stringOr(user.id, ""),
                    username: normalizeUsername(user.username || ""),
                    displayName: stringOr(user.displayName, stringOr(user.username, "")),
                    passwordHash: stringOr(user.passwordHash, ""),
                    createdAt: stringOr(user.createdAt, ""),
                    updatedAt: stringOr(user.updatedAt, ""),
                }))
                .filter((user) => user.id && user.username && user.passwordHash),
        };
    } catch {
        return { users: [] };
    }
}

function writeUserStore(store: AuthUserStore) {
    const path = getAppConfig().auth.userStorePath;
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify({ users: store.users }, null, 2)}\n`, "utf8");
    renameSync(tempPath, path);
}

function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const iterations = 100000;
    const hash = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex");
    return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
    const [algorithm, iterations, salt, expectedHash] = passwordHash.split("$");
    if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expectedHash) return false;
    const actual = pbkdf2Sync(password, salt, Number(iterations), 32, "sha256");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function sign(payload: string, secret: string) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
}

function publicUser(user: StoredAuthUser): AuthUser {
    return { id: user.id, username: user.username, displayName: user.displayName };
}

function normalizeUsername(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeDisplayName(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 32) : fallback;
}

function validateUsername(username: string) {
    if (!/^[a-z0-9_-]{3,32}$/.test(username)) throw new AuthInputError("用户名需为 3-32 位小写字母、数字、下划线或短横线");
}

function validatePassword(password: string) {
    if (password.length < 6 || password.length > 128) throw new AuthInputError("密码长度需为 6-128 位");
}

function base64UrlEncode(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
}

function stringOr(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberOr(value: unknown, fallback: number) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}
