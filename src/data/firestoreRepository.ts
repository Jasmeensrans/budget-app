import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { Repository } from './repository';
import type { CollectionName, Collections, DocPatch, ID, NewDoc } from './types';

/**
 * Firestore implementation of Repository. Same contract as the localStorage one:
 *   users/{uid}/{collection}/{id}
 * Each document also stores its own `id`, so a backup or export round-trips unchanged.
 */

const BATCH_LIMIT = 450; // Firestore allows 500 writes per batch; leave headroom.

function chunks<T>(items: T[], size = BATCH_LIMIT): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function createFirestoreRepository(db: Firestore, uid: string): Repository {
  const col = (name: CollectionName) => collection(db, 'users', uid, name);
  const ref = (name: CollectionName, id: ID) => doc(db, 'users', uid, name, id);
  const now = () => new Date().toISOString();

  return {
    subscribe<K extends CollectionName>(name: K, listener: (docs: Collections[K][]) => void) {
      return onSnapshot(
        col(name),
        (snap) => listener(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as Collections[K])),
        (err) => console.error(`Couldn't load ${name}:`, err),
      );
    },

    async create<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>) {
      const [created] = await this.createMany(name, [data]);
      return created;
    },

    async createMany<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>[]) {
      const t = now();
      const created = data.map((d) => {
        const id = doc(col(name)).id;
        return { ...(d as object), id, createdAt: t, updatedAt: t } as unknown as Collections[K];
      });
      for (const part of chunks(created)) {
        const batch = writeBatch(db);
        for (const d of part) batch.set(ref(name, (d as { id: ID }).id), d as object);
        await batch.commit();
      }
      return created;
    },

    async update<K extends CollectionName>(name: K, id: ID, patch: DocPatch<Collections[K]>) {
      await updateDoc(ref(name, id), { ...(patch as object), updatedAt: now() });
    },

    async updateMany<K extends CollectionName>(name: K, patches: Array<{ id: ID; patch: DocPatch<Collections[K]> }>) {
      const t = now();
      for (const part of chunks(patches)) {
        const batch = writeBatch(db);
        for (const p of part) batch.update(ref(name, p.id), { ...(p.patch as object), updatedAt: t });
        await batch.commit();
      }
    },

    async remove<K extends CollectionName>(name: K, id: ID) {
      await deleteDoc(ref(name, id));
    },

    async putMany<K extends CollectionName>(name: K, docs: Collections[K][]) {
      for (const part of chunks(docs)) {
        const batch = writeBatch(db);
        for (const d of part) batch.set(ref(name, (d as { id: ID }).id), d as object);
        await batch.commit();
      }
    },

    async removeMany<K extends CollectionName>(name: K, ids: ID[]) {
      for (const part of chunks(ids)) {
        const batch = writeBatch(db);
        for (const id of part) batch.delete(ref(name, id));
        await batch.commit();
      }
    },
  };
}
