import type { Logs, Settings } from "./types";

const BACKUP_FILE_NAME = "neurolegs-backup.json";
const SYNC_KEY_PREFIX = "neurolegs-sync-v1:";
const DEFAULT_SYNC_LABEL = "main";

type BackupPayload = {
  app: "neurolegs-local";
  version: 1;
  exportedAt: string;
  logs: Logs;
  settings: Settings;
};

export function buildBackupPayload(logs: Logs, settings: Settings): BackupPayload {
  return {
    app: "neurolegs-local",
    version: 1,
    exportedAt: new Date().toISOString(),
    logs,
    settings,
  };
}

export function parseBackupPayload(raw: string): { logs: Logs; settings: Settings } {
  const parsed = JSON.parse(raw) as Partial<BackupPayload>;
  if (!parsed || parsed.app !== "neurolegs-local" || !parsed.logs || !parsed.settings) {
    throw new Error("Invalid backup payload");
  }
  return { logs: parsed.logs, settings: parsed.settings };
}

function normalizeSyncLabel(syncLabel?: string): string {
  const safe = (syncLabel ?? "").trim().toLowerCase();
  return safe || DEFAULT_SYNC_LABEL;
}

function buildBackupDescription(syncLabel?: string): string {
  return `NeuroLegs local backup [neurolegs-sync:${normalizeSyncLabel(syncLabel)}]`;
}

export async function pushBackupToGitHubGist(params: {
  token: string;
  gistId?: string;
  syncLabel?: string;
  logs: Logs;
  settings: Settings;
}): Promise<{ gistId: string; htmlUrl: string }> {
  const { token, gistId, syncLabel, logs, settings } = params;
  const payload = JSON.stringify(buildBackupPayload(logs, settings), null, 2);

  const body = {
    description: buildBackupDescription(syncLabel),
    public: false,
    files: {
      [BACKUP_FILE_NAME]: { content: payload },
    },
  };

  const endpoint = gistId ? `https://api.github.com/gists/${gistId}` : "https://api.github.com/gists";
  const method = gistId ? "PATCH" : "POST";

  const response = await fetch(endpoint, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text.slice(0, 240)}`);
  }

  const data = (await response.json()) as { id: string; html_url: string };
  return {
    gistId: data.id,
    htmlUrl: data.html_url,
  };
}

export async function pullBackupFromGitHubGist(params: {
  token: string;
  gistId: string;
}): Promise<{ logs: Logs; settings: Settings; pulledAt: string }> {
  const { token, gistId } = params;

  const response = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text.slice(0, 240)}`);
  }

  const data = (await response.json()) as {
    files?: Record<string, { content?: string; raw_url?: string }>;
  };

  const file = data.files?.[BACKUP_FILE_NAME] ?? Object.values(data.files ?? {})[0];
  if (!file) {
    throw new Error("No backup file found in gist.");
  }

  let content = file.content ?? "";
  if (!content && file.raw_url) {
    const rawResponse = await fetch(file.raw_url);
    content = await rawResponse.text();
  }

  const parsed = parseBackupPayload(content);
  return {
    ...parsed,
    pulledAt: new Date().toISOString(),
  };
}

type GistSummary = {
  id: string;
  description?: string;
  updated_at?: string;
  files?: Record<string, unknown>;
};

function sortByUpdatedDesc(a: GistSummary, b: GistSummary): number {
  const aTs = a.updated_at ? Date.parse(a.updated_at) : 0;
  const bTs = b.updated_at ? Date.parse(b.updated_at) : 0;
  return bTs - aTs;
}

export async function findBackupGistId(params: {
  token: string;
  syncLabel?: string;
}): Promise<string | null> {
  const label = normalizeSyncLabel(params.syncLabel);
  const marker = `[neurolegs-sync:${label}]`;
  const response = await fetch("https://api.github.com/gists?per_page=100", {
    method: "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${params.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${text.slice(0, 240)}`);
  }

  const gists = (await response.json()) as GistSummary[];
  const hasBackupFile = (gist: GistSummary) => Boolean(gist.files?.[BACKUP_FILE_NAME]);

  const exactMatch = gists
    .filter((gist) => hasBackupFile(gist) && (gist.description ?? "").includes(marker))
    .sort(sortByUpdatedDesc)[0];
  if (exactMatch) {
    return exactMatch.id;
  }

  const legacyMatch = gists
    .filter((gist) => hasBackupFile(gist) && (gist.description ?? "").includes("NeuroLegs local backup"))
    .sort(sortByUpdatedDesc)[0];
  if (legacyMatch) {
    return legacyMatch.id;
  }

  return null;
}

type SyncKeyPayload = {
  token: string;
  gistId: string;
};

function encodeBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64Utf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildGitHubSyncKey(payload: SyncKeyPayload): string {
  const token = payload.token.trim();
  const gistId = payload.gistId.trim();
  if (!token || !gistId) {
    throw new Error("Both token and gist id are required.");
  }

  const json = JSON.stringify({ token, gistId });
  return `${SYNC_KEY_PREFIX}${encodeBase64Utf8(json)}`;
}

export function parseGitHubSyncKey(syncKey: string): SyncKeyPayload {
  const raw = syncKey.trim();
  const encoded = raw.startsWith(SYNC_KEY_PREFIX) ? raw.slice(SYNC_KEY_PREFIX.length) : raw;
  if (!encoded) {
    throw new Error("Sync key is empty.");
  }

  let parsed: Partial<SyncKeyPayload>;
  try {
    const decoded = decodeBase64Utf8(encoded);
    parsed = JSON.parse(decoded) as Partial<SyncKeyPayload>;
  } catch {
    throw new Error("Invalid sync key format.");
  }

  const token = parsed.token?.trim() ?? "";
  const gistId = parsed.gistId?.trim() ?? "";
  if (!token || !gistId) {
    throw new Error("Sync key is missing token or gist id.");
  }

  return { token, gistId };
}
