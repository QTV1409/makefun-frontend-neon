// Hash routing for the four surfaces. Each route is reachable by a link
// and by its own URL, and sets window.__shotReady false while it loads
// and true once its data is on screen.
//
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/u/<handle>                    an account's public profile

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { takesEntries } from './format.js';
import { board, bounty, bountyCard, errorBox, leaderboard, loading, profile } from './views.js';

/** Board state: search text, filter and sort, kept in memory and in the hash. */
export const boardState = { q: '', filter: 'all', sort: 'deadline', filtered: [] };

/** The board data of the current page, for in-place re-filtering. */
let lastBoardData = null;

/** Filter + sort the board items for the current state. */
export function applyBoard(data) {
  const q = boardState.q.trim().toLowerCase();
  let items = (data.items ?? []).filter((b) => {
    if (boardState.filter === 'ending') return takesEntries(b) && new Date(b.deadline).getTime() - Date.now() < 86400000;
    if (boardState.filter === 'free') return !b.entryFeeUsd;
    if (boardState.filter === 'fee') return Boolean(b.entryFeeUsd);
    return true;
  });
  if (q) {
    items = items.filter((b) => `${b.title} ${(b.skills ?? []).join(' ')} ${b.category ?? ''}`.toLowerCase().includes(q));
  }
  // Ending soonest: upcoming deadlines first, already-ended bounties last.
  const deadlineKey = (b) => {
    const ms = new Date(b.deadline).getTime() - Date.now();
    return ms > 0 ? ms : Number.POSITIVE_INFINITY;
  };
  const by = {
    deadline: (a, b) => deadlineKey(a) - deadlineKey(b),
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount),
    entries: (a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0),
    newest: (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  };
  boardState.filtered = [...items].sort(by[boardState.sort] ?? by.deadline);
  return boardState.filtered;
}

/**
 * Re-apply the board filter/sort and replace only the list, so typing
 * in the search box never loses focus or the caret.
 */
export function updateBoard(app) {
  if (!lastBoardData) return;
  applyBoard(lastBoardData);
  const list = app.querySelector('.grid, .empty');
  const count = app.querySelector('.count');
  if (!list) return;
  if (boardState.filtered.length) {
    list.outerHTML = `<ul class="grid">${boardState.filtered.map(bountyCard).join('')}</ul>`;
  } else {
    list.outerHTML = '<p class="empty">No bounties match that search. Clear the search or pick another filter.</p>';
  }
  if (count) {
    count.textContent = `${boardState.filtered.length} ${boardState.filtered.length === 1 ? 'bounty' : 'bounties'} shown`;
  }
}

/** Parse the hash into a route: { name, slug, handle, view }. */
export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const params = new URLSearchParams(query ?? '');
  const bountyMatch = path.match(/^\/bounty\/([^/]+)(\/leaderboard)?$/);
  if (bountyMatch) {
    return {
      name: bountyMatch[2] ? 'leaderboard' : 'bounty',
      slug: decodeURIComponent(bountyMatch[1]),
      view: params.get('view') ?? 'performance',
    };
  }
  const profileMatch = path.match(/^\/(?:u|profile)\/([^/]+)$/);
  if (profileMatch) return { name: 'profile', handle: decodeURIComponent(profileMatch[1]) };
  return {
    name: 'board',
    q: params.get('q') ?? '',
    filter: params.get('filter') ?? 'all',
    sort: params.get('sort') ?? 'deadline',
  };
}

/** Render the current route into #app. */
export async function render(app) {
  window.__shotReady = false;
  const route = parseHash();
  try {
    if (route.name === 'bounty') {
      app.innerHTML = loading('bounty');
      const b = await getBounty(route.slug);
      document.title = `${b.title} | Neon Board`;
      app.innerHTML = bounty(b);
    } else if (route.name === 'leaderboard') {
      app.innerHTML = loading('leaderboard');
      const data = await getLeaderboard(route.slug, route.view);
      document.title = `Leaderboard · ${data.competition?.title ?? route.slug} | Neon Board`;
      app.innerHTML = leaderboard(data, route.slug, route.view);
    } else if (route.name === 'profile') {
      app.innerHTML = loading('profile');
      const p = await getProfile(route.handle);
      document.title = `@${p.handle} | Neon Board`;
      app.innerHTML = profile(p);
    } else {
      boardState.q = route.q;
      boardState.filter = route.filter;
      boardState.sort = route.sort;
      app.innerHTML = loading('bounties');
      const data = await getBounties();
      lastBoardData = data;
      applyBoard(data);
      document.title = 'Neon Board · make.fun bounties';
      app.innerHTML = board(data, boardState);
    }
  } catch (err) {
    document.title = 'Error | Neon Board';
    app.innerHTML = errorBox(err.message ?? 'Something went wrong.');
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}
