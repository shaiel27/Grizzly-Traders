// Caché LRU genérica en memoria, pura (sin TTL): la caducidad la decide quien la usa.
// Se apoya en el orden de inserción de Map (recency = orden de iteración), por lo que
// get/set cuestan O(1) sin estructuras auxiliares. Máximo 0 o negativo = no cachea nada.
export interface LruCache<K, V> {
  get(key: K): V | undefined
  set(key: K, value: V): void
  delete(key: K): boolean
  readonly size: number
}

export function createLruCache<K, V>(maxEntries: number): LruCache<K, V> {
  const store = new Map<K, V>()

  return {
    get(key) {
      if (!store.has(key)) return undefined
      // Tocar la recencia: reinsertar al final marca la entrada como la más usada
      const value = store.get(key) as V
      store.delete(key)
      store.set(key, value)
      return value
    },
    set(key, value) {
      if (maxEntries <= 0) return
      store.delete(key)
      store.set(key, value)
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value as K
        store.delete(oldest)
      }
    },
    delete(key) {
      return store.delete(key)
    },
    get size() {
      return store.size
    },
  }
}
