import type { CollectionName, Collections, DocPatch, ID, NewDoc } from './types';

/**
 * The only way the app reads or writes data.
 *
 * `subscribe` behaves like Firestore's onSnapshot: it calls the listener right away
 * with the current documents, then again after every change. Writes are async so a
 * Firestore implementation can drop in without touching any screen.
 */
export interface Repository {
  subscribe<K extends CollectionName>(name: K, listener: (docs: Collections[K][]) => void): () => void;
  create<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>): Promise<Collections[K]>;
  /** Batch create (imports, seeding). Firestore: a single writeBatch. */
  createMany<K extends CollectionName>(name: K, data: NewDoc<Collections[K]>[]): Promise<Collections[K][]>;
  update<K extends CollectionName>(name: K, id: ID, patch: DocPatch<Collections[K]>): Promise<void>;
  /** Batch update (applying rules, recategorizing). Firestore: a single writeBatch. */
  updateMany<K extends CollectionName>(name: K, patches: Array<{ id: ID; patch: DocPatch<Collections[K]> }>): Promise<void>;
  remove<K extends CollectionName>(name: K, id: ID): Promise<void>;
  /** Writes documents with their existing ids (restoring a backup). Firestore: writeBatch of set(). */
  putMany<K extends CollectionName>(name: K, docs: Collections[K][]): Promise<void>;
  /** Batch delete. Firestore: a single writeBatch. */
  removeMany<K extends CollectionName>(name: K, ids: ID[]): Promise<void>;
}
