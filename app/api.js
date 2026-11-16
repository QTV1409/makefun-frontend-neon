// make.fun's public API, read-only GET requests, open to any origin (CORS).
// Docs: https://make.fun/api/openapi.json and https://make.fun/llms.txt
// Nothing here signs in or writes; every call is a plain GET.

import { EtagCache } from './cache.js';

export const API = 'https://make.fun/api';

const cache = new EtagCache();

/** An API failure with its HTTP status, for the error screens. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Turn a possibly relative API image path into an absolute https://make.fun URL. */
export function absUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Paths starting with '/' are relative to the site root (https://make.fun),
  // e.g. '/api/avatars/….webp'; anything else is relative to the API.
  if (url.startsWith('/')) return `https://make.fun${url}`;
  return `${API}/${url}`;
}

/**
 * GET one API path as JSON, revalidating with the cached ETag when we have one.
 * A 304 reuses the cached body; a fresh 200 stores its new ETag.
 */
export async function get(path) {
  const hit = cache.get(path);
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(API + path, { headers });
  } catch {
    throw new ApiError(0, 'Could not reach make.fun. Check your connection and try again.');
  }
  if (res.status === 304 && hit) return hit.body;
  if (!res.ok) {
    cache.drop(path);
    const msg = res.status === 404
      ? 'make.fun has nothing at that address (404).'
      : `make.fun answered ${res.status}. Try again in a moment.`;
    throw new ApiError(res.status, msg);
  }
  const body = await res.json();
  const etag = res.headers.get('ETag');
  if (etag) cache.set(path, etag, body);
  return body;
}

/** The live bounty board. */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard; view is 'performance' or 'overall'. */
export const getLeaderboard = (slug, view = 'performance') =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard?view=${encodeURIComponent(view)}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
