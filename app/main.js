// Neon Board: a fast, read-only make.fun frontend on hash routes.
// The router fetches and renders; this file wires up the page once:
// hash changes, the board toolbar (search / filter / sort), retry buttons,
// leaderboard view switches, and keyboard shortcuts.
//
// window.__shotReady is false while a page loads and true once its data is
// on screen, so a screenshot script knows when to capture.

import { boardState, render, updateBoard } from './router.js';

const app = document.getElementById('app');

window.__shotReady = false;
window.addEventListener('hashchange', () => render(app));

/** Debounce typing in the board search so each keystroke does not re-filter. */
let searchTimer = 0;

app.addEventListener('input', (event) => {
  if (event.target.id !== 'q') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    boardState.q = event.target.value;
    updateBoard(app);
  }, 120);
});

app.addEventListener('change', (event) => {
  if (event.target.id === 'sort') {
    boardState.sort = event.target.value;
    updateBoard(app);
  }
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'retry') {
    render(app);
    return;
  }
  if (action === 'filter') {
    boardState.filter = button.dataset.filter;
    app.querySelectorAll('[data-action="filter"]').forEach((chip) => {
      chip.setAttribute('aria-pressed', String(chip === button));
    });
    updateBoard(app);
    return;
  }
  if (action === 'lb-view') {
    const view = button.dataset.view;
    const hash = location.hash.split('?')[0];
    location.hash = `${hash}?view=${view}`;
  }
});

/** '/' focuses the board search; Escape clears it. */
document.addEventListener('keydown', (event) => {
  const input = document.getElementById('q');
  if (event.key === '/' && document.activeElement !== input && input) {
    event.preventDefault();
    input.focus();
  }
  if (event.key === 'Escape' && document.activeElement === input) {
    input.value = '';
    boardState.q = '';
    updateBoard(app);
    input.blur();
  }
});

render(app);
