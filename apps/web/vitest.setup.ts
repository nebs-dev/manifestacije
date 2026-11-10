/**
 * Node 26 ships its own `localStorage` global that stays undefined unless the
 * process is started with `--localstorage-file`. That property already exists
 * on `globalThis` when the jsdom environment boots, so Vitest keeps it instead
 * of copying jsdom's own `localStorage` over it: browser code under test sees
 * `localStorage === undefined` and throws, while `sessionStorage` works.
 *
 * Restore it per test file. A same-origin iframe hands out a real jsdom
 * `Storage`, which keeps working after the frame is detached and, unlike a
 * hand-written stand-in, is accepted as `storageArea` by `StorageEvent`. The
 * in-memory fallback only runs if that ever stops working.
 */
function jsdomStorages(): { local?: Storage; session?: Storage } {
  try {
    const frame = document.createElement("iframe")
    document.body.append(frame)
    const win = frame.contentWindow as Window | null
    const storages = { local: win?.localStorage, session: win?.sessionStorage }
    frame.remove()
    return storages
  } catch {
    return {}
  }
}

/** jsdom's own `StorageEvent` only accepts a `Storage` it recognises. */
function usableAsStorageArea(storage: Storage | undefined) {
  if (!storage) return false
  try {
    new StorageEvent("storage", { storageArea: storage })
    return true
  } catch {
    return false
  }
}

class MemoryStorage implements Storage {
  #items = new Map<string, string>()

  get length() {
    return this.#items.size
  }

  key(index: number) {
    return [...this.#items.keys()][index] ?? null
  }

  getItem(key: string) {
    return this.#items.get(String(key)) ?? null
  }

  setItem(key: string, value: string) {
    this.#items.set(String(key), String(value))
  }

  removeItem(key: string) {
    this.#items.delete(String(key))
  }

  clear() {
    this.#items.clear()
  }
}

function install(name: "localStorage" | "sessionStorage", storage: Storage) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: storage })
  if (window !== (globalThis as unknown as Window)) {
    Object.defineProperty(window, name, { configurable: true, writable: true, value: storage })
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  const frame = !window.localStorage || !usableAsStorageArea(window.sessionStorage) ? jsdomStorages() : {}
  if (!window.localStorage) install("localStorage", frame.local ?? new MemoryStorage())
  // The copy Vitest publishes as a global is rejected by jsdom's StorageEvent;
  // the frame's own object is the one jsdom recognises.
  if (frame.session && !usableAsStorageArea(window.sessionStorage)) install("sessionStorage", frame.session)
}
