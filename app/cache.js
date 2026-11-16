// Minute-bound ETag cache for make.fun's public API.
// The API sends an ETag bound to the minute: revalidating with
// If-None-Match inside the same minute answers 304, so a repeat
// visit costs one tiny round trip and no body at all.

/** One cached answer: its ETag, its parsed body, and the minute it was fetched in. */
export class EtagCache {
  constructor() {
    this.store = new Map();
  }

  /** The cache key for a path: the path plus the current minute. */
  key(path) {
    return `${path}|${Math.floor(Date.now() / 60000)}`;
  }

  get(path) {
    return this.store.get(this.key(path)) ?? null;
  }

  set(path, etag, body) {
    this.store.set(this.key(path), { etag, body });
  }

  /** Forget one path (used after a failed revalidation). */
  drop(path) {
    this.store.delete(this.key(path));
  }
}
