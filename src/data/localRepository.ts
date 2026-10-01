import type { Repository } from './repository';
import type { CollectionName, Collections, DocMeta, DocPatch, ID, NewDoc } from './types';

/** localStorage implementation of Repository. One key per collection. */

const PREFIX = 'budget-app:v2:';
const LEGACY_KEY = 'budget-app:v1';

type AnyDoc = DocMeta & Record<string, unknown>;
type Listener = (docs: AnyDoc[]) => void;

export function createLocalRepository(): Repository {
  migrateLegacyStorage();

  const cache = new Map<CollectionName, AnyDoc[]>();
  const listeners = new Map<CollectionName, Set<Listener>>();

  function read(name: CollectionName): AnyDoc[] {
    let docs = cache.get(name);
    if (!docs) {
      docs = [];
      try {
        const raw = localStorage.getItem(PREFIX + name);
        if (raw) docs = JSON.parse(raw) as AnyDoc[];
      } catch {
        // Unreadable storage: start empty rather than crash.
      }
      cache.set(name, docs);
    }
    return docs;
  }

  function write(name: CollectionName, docs: AnyDoc[]) {
    cache.set(name, docs);
    try {
      localStorage.setItem(PREFIX + name, JSON.stringify(docs));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
    listeners.get(name)?.forEach((listener) => listener(docs));
  }

  // Keep other open tabs in sync.
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const name = e.key.slice(PREFIX.length) as CollectionName;
    cache.delete(name);
    const docs = read(name);
    listeners.get(name)?.forEach((listener) => listener(docs));
  });

  const now = () => new Date().toISOString();

  return {
    subscribe<K extends CollectionName>(name: K, listener: (docs: Collections[K][]) => void) {
      const l = listener as unknown as Listener;
      let set = listeners.get(name);
      if (!set) {
        set = new Set();
        listeners.set(name, set);
      }
      set.add(l);
      l(read(name));
      return () => {
        set.delete(l);
      };
    },

    async create<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>) {
      const [doc] = await this.createMany(name, [data]);
      return doc;
    },

    async createMany<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>[]) {
      const t = now();
      const created = data.map((d) => ({ ...(d as object), id: crypto.randomUUID(), createdAt: t, updatedAt: t }) as AnyDoc);
      write(name, [...read(name), ...created]);
      return created as unknown as Collections[K][];
    },

    async update<K extends CollectionName>(name: K, id: ID, patch: DocPatch<Collections[K]>) {
      write(
        name,
        read(name).map((d) => (d.id === id ? { ...d, ...(patch as object), updatedAt: now() } : d)),
      );
    },

    async updateMany<K extends CollectionName>(name: K, patches: Array<{ id: ID; patch: DocPatch<Collections[K]> }>) {
      if (patches.length === 0) return;
      const byId = new Map(patches.map((p) => [p.id, p.patch as object]));
      const t = now();
      write(
        name,
        read(name).map((d) => (byId.has(d.id) ? { ...d, ...byId.get(d.id), updatedAt: t } : d)),
      );
    },

    async putMany<K extends CollectionName>(name: K, docs: Collections[K][]) {
      const incoming = new Map((docs as unknown as AnyDoc[]).map((d) => [d.id, d]));
      const kept = read(name).filter((d) => !incoming.has(d.id));
      write(name, [...kept, ...incoming.values()]);
    },

    async remove<K extends CollectionName>(name: K, id: ID) {
      write(name, read(name).filter((d) => d.id !== id));
    },

    async removeMany<K extends CollectionName>(name: K, ids: ID[]) {
      const drop = new Set(ids);
      write(name, read(name).filter((d) => !drop.has(d.id)));
    },
  };
}

/** Converts the first prototype's single-key storage (dollar amounts) to the v2 layout. */
function migrateLegacyStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    if (localStorage.getItem(PREFIX + 'transactions') || localStorage.getItem(PREFIX + 'categories')) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    const legacy = JSON.parse(raw) as {
      transactions?: Array<{ id: string; date: string; amount: number; description: string; categoryId: string | null; note?: string; source?: string; createdAt?: string }>;
      categories?: Array<{ id: string; name: string; color: string; icon?: string }>;
    };
    const t = new Date().toISOString();
    const icons: Record<string, string> = {
      groceries: 'cart', dining: 'utensils', transport: 'car', shopping: 'bag', entertainment: 'ticket',
      utilities: 'bolt', health: 'heart', rent: 'home', travel: 'globe', income: 'dollar',
    };
    if (legacy.categories?.length) {
      const categories = legacy.categories.map((c) => ({ ...c, icon: c.icon ?? icons[c.id] ?? 'tag', createdAt: t, updatedAt: t }));
      localStorage.setItem(PREFIX + 'categories', JSON.stringify(categories));
    }
    if (legacy.transactions?.length) {
      const transactions = legacy.transactions.map((x) => ({
        id: x.id,
        date: x.date,
        amountCents: Math.round(x.amount * 100),
        description: x.description,
        categoryId: x.categoryId,
        note: x.note ?? '',
        source: x.source === 'import' ? 'import' : 'manual',
        importId: null,
        createdAt: x.createdAt ?? t,
        updatedAt: x.createdAt ?? t,
      }));
      localStorage.setItem(PREFIX + 'transactions', JSON.stringify(transactions));
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Leave legacy data alone if it can't be read.
  }
}
