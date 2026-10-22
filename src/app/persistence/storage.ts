// localStorage repositories (ARCHITECTURE §6.3). Storage failure never crashes the game.
export const KEYS = {
  settings: "zgr.v1.settings",
  scenarios: "zgr.v1.scenarios",
  current: "zgr.v1.current",
  results: "zgr.v1.results",
  obstacles: "zgr.v1.obstacles",
} as const;

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { schemaVersion?: number; data: T };
    return migrate(key, parsed) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, data: T): boolean {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify({ schemaVersion: 1, data }));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Step-by-step upgrades of stored records. v1 is the first version. */
function migrate<T>(_key: string, rec: { schemaVersion?: number; data: T }): T | undefined {
  if (rec.schemaVersion === 1) return rec.data;
  return undefined;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickJsonFile(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error("no file"));
      f.text().then((txt) => {
        try {
          resolve(JSON.parse(txt));
        } catch (e) {
          reject(e);
        }
      }, reject);
    };
    input.click();
  });
}
