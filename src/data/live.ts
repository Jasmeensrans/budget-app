import { useSyncExternalStore } from 'react';
import { createLocalRepository } from './localRepository';
import type { Repository } from './repository';
import type { CollectionName, Collections } from './types';

/**
 * Live, in-memory copies of each collection, kept current by the active repository.
 *
 * The active repository is localStorage until someone signs in, then Firestore
 * (see auth.tsx). `connectRepository` swaps it; every screen re-renders from the new source.
 */

let active: Repository = createLocalRepository();

/** Always delegates to whichever repository is active, so actions never hold a stale one. */
export const repo: Repository = {
  subscribe: (name, listener) => active.subscribe(name, listener),
  create: (name, data) => active.create(name, data),
  createMany: (name, data) => active.createMany(name, data),
  update: (name, id, patch) => active.update(name, id, patch),
  updateMany: (name, patches) => active.updateMany(name, patches),
  remove: (name, id) => active.remove(name, id),
  putMany: (name, docs) => active.putMany(name, docs),
  removeMany: (name, ids) => active.removeMany(name, ids),
};

const EMPTY: unknown[] = [];
const snapshots = new Map<CollectionName, unknown[]>();
const unsubscribers = new Map<CollectionName, () => void>();
const loaded = new Set<CollectionName>();
const loadWaiters = new Map<CollectionName, Array<() => void>>();
const reactListeners = new Map<CollectionName, Set<() => void>>();
const subscribeFns = new Map<CollectionName, (onChange: () => void) => () => void>();
const loadListeners = new Set<() => void>();
let loadVersion = 0;

/** Fills in fields added after a document was saved, so old data keeps working. */
function normalize(name: CollectionName, docs: unknown[]): unknown[] {
  if (name === 'categories') {
    return (docs as Array<Record<string, unknown>>).map((c) =>
      c.kind ? c : { ...c, kind: c.name === 'Income' ? 'income' : 'spending' },
    );
  }
  if (name === 'transactions') {
    return (docs as Array<Record<string, unknown>>).map((t) =>
      'accountId' in t ? t : { ...t, accountId: null, rawDescription: null, original: null },
    );
  }
  return docs;
}

function notify(name: CollectionName) {
  reactListeners.get(name)?.forEach((fn) => fn());
}

function markLoaded(name: CollectionName) {
  if (loaded.has(name)) return;
  loaded.add(name);
  loadWaiters.get(name)?.forEach((resolve) => resolve());
  loadWaiters.delete(name);
  loadVersion++;
  loadListeners.forEach((fn) => fn());
}

function ensureSubscribed(name: CollectionName) {
  if (unsubscribers.has(name)) return;
  if (!snapshots.has(name)) snapshots.set(name, EMPTY);
  const source = active;
  const unsubscribe = source.subscribe(name, (docs) => {
    if (source !== active) return; // a late update from a repository we've switched away from
    snapshots.set(name, normalize(name, docs));
    markLoaded(name);
    notify(name);
  });
  unsubscribers.set(name, unsubscribe);
}

/** Switches every collection to a new data source (sign in / sign out). */
export function connectRepository(next: Repository) {
  unsubscribers.forEach((unsubscribe) => unsubscribe());
  unsubscribers.clear();
  snapshots.clear();
  loaded.clear();
  active = next;
  loadVersion++;
  loadListeners.forEach((fn) => fn());
  for (const name of reactListeners.keys()) {
    ensureSubscribed(name);
    notify(name);
  }
}

function subscribeFor(name: CollectionName) {
  let fn = subscribeFns.get(name);
  if (!fn) {
    fn = (onChange) => {
      let set = reactListeners.get(name);
      if (!set) {
        set = new Set();
        reactListeners.set(name, set);
      }
      set.add(onChange);
      return () => {
        set.delete(onChange);
      };
    };
    subscribeFns.set(name, fn);
  }
  return fn;
}

/** Current documents of a collection, outside React (actions, sync jobs). */
export function current<K extends CollectionName>(name: K): Collections[K][] {
  ensureSubscribed(name);
  return (snapshots.get(name) ?? EMPTY) as Collections[K][];
}

/** Resolves once a collection's first snapshot has arrived from the active repository. */
export function whenLoaded(name: CollectionName): Promise<void> {
  ensureSubscribed(name);
  if (loaded.has(name)) return Promise.resolve();
  return new Promise((resolve) => {
    loadWaiters.set(name, [...(loadWaiters.get(name) ?? []), resolve]);
  });
}

/** Live documents of a collection; re-renders on every change. */
export function useCollection<K extends CollectionName>(name: K): Collections[K][] {
  ensureSubscribed(name);
  return useSyncExternalStore(subscribeFor(name), () => (snapshots.get(name) ?? EMPTY) as Collections[K][]);
}

/** True once every named collection has loaded from the active repository. */
export function useCollectionsLoaded(names: CollectionName[]): boolean {
  names.forEach(ensureSubscribed);
  useSyncExternalStore(
    (onChange) => {
      loadListeners.add(onChange);
      return () => {
        loadListeners.delete(onChange);
      };
    },
    () => loadVersion,
  );
  return names.every((n) => loaded.has(n));
}
