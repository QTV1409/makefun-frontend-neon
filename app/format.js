// Small helpers for showing API values. Everything that lands in HTML
// goes through esc() first; the markdown renderer escapes before it marks up.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('500.00', 0.5, null) as '$500' or '$0.50'. */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** An ISO date as a short UTC date + time. */
export function date(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '2d 4h left', '35m left', or 'ended'. */
export function timeLeft(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** Whether a bounty still takes entries: by its deadline, not its status alone. */
export function takesEntries(bounty) {
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** A micro-unit value (judge win rate in millionths) as a percent with one decimal. */
export function microPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10000).toFixed(1)}%`;
}

/** A byte count as '660 KB' / '1.2 MB'. */
export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

/** A wallet address shortened for display. */
export function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Inline markdown: **bold**, *italic*, `code`, [text](https://make.fun/…). */
function inlineMd(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/**
 * A small, safe markdown renderer for bounty descriptions:
 * headings, paragraphs, bullet lists and fenced code blocks.
 * Anything it does not recognise stays plain escaped text.
 */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let inList = false;
  let inCode = false;
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      closeList();
      html += inCode ? '</code></pre>' : '<pre><code>';
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html += `${esc(line)}\n`;
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 1;
      html += `<h${level}>${inlineMd(heading[2])}</h${level}>`;
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMd(bullet[1])}</li>`;
      continue;
    }
    closeList();
    if (line.trim()) html += `<p>${inlineMd(line.trim())}</p>`;
  }
  closeList();
  if (inCode) html += '</code></pre>';
  return html;
}
