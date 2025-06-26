declare module 'lru-cache' {
  interface Options<K = any, V = any> {
    max?: number;
    ttl?: number;
    updateAgeOnGet?: boolean;
  }

  class LRUCache<K = any, V = any> {
    constructor(options?: Options<K, V>);
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    delete(key: K): boolean;
    clear(): void;
    has(key: K): boolean;
    size: number;
    max: number;
    ttl?: number;
    entries(): IterableIterator<[K, V]>;
    values(): IterableIterator<V>;
  }

  export = LRUCache;
}
