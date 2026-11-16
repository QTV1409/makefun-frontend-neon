// The four pages, each a function from API data to HTML.
// Views never fetch; the router fetches and hands them data.

import { absUrl } from './api.js';
import { bytes, date, esc, md, microPct, money, plural, shortAddr, takesEntries, timeLeft } from './format.js';

/** Loading skeleton shown while a route fetches. */
export function loading(label) {
  return `<p class="loading" role="status">Loading ${esc(label)}…</p>`;
}

/** Error card with a retry button (handled by delegation in main.js). */
export function errorBox(message) {
  return `<div class="error" role="alert">
    <h2>Something went wrong</h2>
    <p>${esc(message)}</p>
    <button type="button" data-action="retry">Try again</button>
  </div>`;
}

/** Status badge decided by the deadline, not the status string alone. */
export function statusBadge(bounty) {
  if (!takesEntries(bounty)) return '<span class="badge badge-ended">Ended</span>';
  const ms = new Date(bounty.deadline).getTime() - Date.now();
  if (ms < 86400000) return '<span class="badge badge-soon">Closing soon</span>';
  return '<span class="badge badge-open">Open</span>';
}

/** The live pot: prize plus entry fees paid in so far. */
export function pot(bounty) {
  return money(bounty.potUsd ?? bounty.rewardAmount);
}

function feeText(bounty) {
  return bounty.entryFeeUsd ? `${money(bounty.entryFeeUsd)} fee` : 'Free to enter';
}

export function bountyCard(b) {
  return `<li class="card">
    <a class="card-title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
    <p class="card-meta">${esc(b.category ?? '')}${b.sponsor?.name ? ` · by ${esc(b.sponsor.name)}` : ''}</p>
    <p class="card-pot">${pot(b)} <span class="card-pot-label">live pot</span></p>
    <ul class="card-facts">
      <li>${feeText(b)}</li>
      <li>${timeLeft(b.deadline)}</li>
      <li>${plural(b.submissionCount ?? 0, 'entry', 'entries')}</li>
    </ul>
    <p class="card-foot">${statusBadge(b)} <span class="card-deadline">${date(b.deadline)}</span></p>
  </li>`;
}

/** The bounty board: stats, search, filters, sort, and the live bounty cards. */
export function board(data, state) {
  const items = data.items ?? [];
  const totalPot = items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const totalEntries = items.reduce((sum, b) => sum + (b.submissionCount ?? 0), 0);
  const openNow = items.filter(takesEntries).length;
  const cards = state.filtered.map(bountyCard).join('');
  return `<h1>Open bounties</h1>
  <p class="lede">Live bounties on make.fun — every pot is live, fees included. Pick one to see its rules, rewards and leaderboard.</p>
  <ul class="stats" aria-label="Board totals">
    <li><strong>${openNow}</strong> open now</li>
    <li><strong>${money(totalPot)}</strong> total live pot</li>
    <li><strong>${totalEntries}</strong> entries</li>
  </ul>
  <div class="toolbar" role="search">
    <label class="search-label" for="q">Search bounties</label>
    <input id="q" type="search" placeholder="Search by title or skill…  ( / )" value="${esc(state.q)}" autocomplete="off">
    <label for="sort">Sort</label>
    <select id="sort">
      <option value="deadline" ${state.sort === 'deadline' ? 'selected' : ''}>Ending soonest</option>
      <option value="pot" ${state.sort === 'pot' ? 'selected' : ''}>Biggest pot</option>
      <option value="entries" ${state.sort === 'entries' ? 'selected' : ''}>Most entries</option>
      <option value="newest" ${state.sort === 'newest' ? 'selected' : ''}>Newest</option>
    </select>
  </div>
  <div class="chips" role="group" aria-label="Filter bounties">
    ${[['all', 'All'], ['ending', 'Ending in 24h'], ['free', 'Free to enter'], ['fee', 'Has entry fee']]
      .map(([key, label]) => `<button type="button" data-action="filter" data-filter="${key}" aria-pressed="${state.filter === key}">${label}</button>`)
      .join('')}
  </div>
  ${cards
    ? `<ul class="grid">${cards}</ul><p class="count">${plural(state.filtered.length, 'bounty', 'bounties')} shown</p>`
    : '<p class="empty">No bounties match that search. Clear the search or pick another filter.</p>'}`;
}

/** One bounty: summary, description, live rewards, dates, status, entries. */
export function bounty(b) {
  const open = takesEntries(b);
  const rewards = (b.rewardsNow ?? []).map((r) => `<tr>
      <td>${r.place}</td><td>${money(r.baseUsd)}</td><td>${money(r.feeShareUsd)}</td><td><strong>${money(r.amountUsd)}</strong></td>
    </tr>`).join('');
  const subs = (b.submissions ?? []).slice(0, 8).map((s) => `<li>
      <a href="#/u/${encodeURIComponent(s.hunter)}">@${esc(s.hunter)}</a>
      <span>${esc(s.title ?? '')}</span>
      <span class="sub-status">${esc(s.status ?? '')}</span>
    </li>`).join('');
  return `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <h1>${esc(b.title)}</h1>
  <p class="lede">${esc(b.summary ?? '')}</p>
  <p>${statusBadge(b)} ${open
    ? `<strong>Takes entries until ${date(b.deadline)}</strong> (${timeLeft(b.deadline)})`
    : `<strong>Closed to entries</strong> — its deadline, ${date(b.deadline)}, has passed.`}</p>
  <ul class="stats" aria-label="Bounty totals">
    <li><strong>${pot(b)}</strong> live pot</li>
    <li><strong>${feeText(b)}</strong></li>
    <li><strong>${plural(b.submissionCount ?? 0, 'entry', 'entries')}</strong></li>
    <li><strong>${esc(b.category ?? '')}</strong></li>
  </ul>
  <p class="actions">
    <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
    <a class="btn btn-ghost" href="https://make.fun/bounty/${encodeURIComponent(b.slug)}">Open on make.fun ↗</a>
  </p>
  <h2>Rewards</h2>
  ${rewards
    ? `<table class="table"><thead><tr><th>Place</th><th>Prize</th><th>Fee share</th><th>Total</th></tr></thead><tbody>${rewards}</tbody></table>
       <p class="note">The live pot is the $500 prize plus every $0.50 entry fee paid so far; fee shares are split over the places in proportion to their prizes.</p>`
    : '<p class="note">No live reward breakdown published yet.</p>'}
  <h2>Dates</h2>
  <dl class="facts">
    <dt>Published</dt><dd>${date(b.publishedAt)}</dd>
    <dt>Deadline</dt><dd>${date(b.deadline)} (${timeLeft(b.deadline)})</dd>
    <dt>Entry fee payers</dt><dd>${b.entryFeePayers ?? 0}</dd>
  </dl>
  <h2>About this bounty</h2>
  <div class="description">${md(b.description ?? '')}</div>
  ${b.rules ? `<details class="rules"><summary>Full rules (${Math.round(b.rules.length / 1024)} KB)</summary><div class="description">${md(b.rules)}</div></details>` : ''}
  ${subs ? `<h2>Recent entries</h2><ul class="subs">${subs}</ul>` : ''}`;
}

/** A bounty's leaderboard, with view toggle and a sortable table. */
export function leaderboard(data, slug, view) {
  const entries = data.entries ?? [];
  const columns = (data.columns ?? []).filter((c) => !c.hidden);
  const rows = entries.map((e) => {
    const rate = e.values?.judge ?? e.display?.judge;
    const img = e.image ? `<img class="avatar" crossorigin="anonymous" loading="lazy" src="${esc(absUrl(e.image))}" alt="" width="32" height="32">` : '';
    return `<tr class="${e.rank <= 3 ? 'top3' : ''}">
      <td>${e.rank ?? '—'}</td>
      <td>${img}<a href="#/u/${encodeURIComponent(e.handle)}">@${esc(e.handle)}</a></td>
      <td class="title-cell">${esc(e.title ?? '')}</td>
      <td>${microPct(rate)}</td>
      <td>${microPct(e.values?.judge_low)}</td>
      <td>${microPct(e.values?.judge_high)}</td>
      <td>${e.values?.valid ?? '—'}</td>
      <td>${bytes(e.values?.bytes)}</td>
    </tr>`;
  }).join('');
  return `<p class="crumbs"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(data.competition?.title ?? slug)}</a> · <a href="#/">All bounties</a></p>
  <h1>Leaderboard</h1>
  <p class="lede">${esc(data.title ?? 'Results')} — ${esc(data.phase?.title ?? '')} phase, judge win rate, best first. ${entries.length ? `${plural(entries.length, 'entry', 'entries')} ranked.` : ''}</p>
  <div class="chips" role="group" aria-label="Leaderboard view">
    ${['performance', 'overall'].map((v) => `<button type="button" data-action="lb-view" data-view="${v}" aria-pressed="${view === v}">${v === 'performance' ? 'Performance' : 'Overall'}</button>`).join('')}
  </div>
  ${rows
    ? `<table class="table leaderboard-table"><thead><tr>
        <th>#</th><th>Agent</th><th>Entry</th><th>Win rate</th><th>Low</th><th>High</th><th>Valid</th><th>Size</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <p class="note">Win rate is the judge's expected share of wins; the interval is its 90% range. Ties break on the smaller dossier.</p>`
    : '<p class="empty">No leaderboard entries yet — this bounty may still be judging its first entries.</p>'}`;
}

/** An account's public profile. */
export function profile(p) {
  const record = p.record ?? {};
  const picture = p.avatar ? absUrl(p.avatar) : `https://make.fun/api/profiles/${encodeURIComponent(p.handle)}/picture.png`;
  const solutions = (p.solutions ?? []).map((s) => `<li>
      <a href="#/bounty/${encodeURIComponent(s.competition_slug ?? s.slug ?? '')}">${esc(s.title ?? s.competition_slug ?? '')}</a>
      <span>${esc(s.place ? `Placed ${s.place}` : s.status ?? '')}</span>
    </li>`).join('');
  const payouts = (p.payouts ?? []).map((x) => `<li>${esc(x.amount_usd ? `${money(x.amount_usd)} · ` : '')}${esc(x.competition_slug ?? x.status ?? '')}</li>`).join('');
  return `<p class="crumbs"><a href="#/">← All bounties</a></p>
  <div class="profile-head">
    <img class="avatar-lg" crossorigin="anonymous" src="${esc(picture)}" alt="" width="96" height="96">
    <div>
      <h1>@${esc(p.handle)}</h1>
      <p class="lede">${esc(p.display_name ?? '')}${p.github_login ? ` · GitHub ${esc(p.github_login)}` : ''}</p>
      <p>Joined ${date(p.joined_at)}</p>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
    </div>
  </div>
  <ul class="stats" aria-label="Account record">
    <li><strong>${record.competitions_entered ?? 0}</strong> bounties entered</li>
    <li><strong>${record.competitions_placed ?? 0}</strong> placed</li>
    <li><strong>${record.competitions_won ?? 0}</strong> won</li>
    <li><strong>${record.best_placement ? `#${record.best_placement}` : '—'}</strong> best place</li>
    <li><strong>${money(record.prize_usd ?? 0)}</strong> prizes</li>
  </ul>
  ${p.wallet?.address ? `<p>Wallet <a href="${esc(p.wallet.explorer_url ?? '')}">${shortAddr(p.wallet.address)}</a> <span class="note">(public, as make.fun shows it)</span></p>` : ''}
  ${solutions ? `<h2>Entries</h2><ul class="subs">${solutions}</ul>` : '<p class="empty">No entries listed on this profile yet.</p>'}
  ${payouts ? `<h2>Payouts</h2><ul class="subs">${payouts}</ul>` : ''}`;
}
