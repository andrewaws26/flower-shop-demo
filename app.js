// ====== CONFIG ======
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSFbE7BWzH5hTWoCtlK_a0mw8RKsBOAJs_-2rbudUkyv-uXUSwkJh03EdqnW-5N-hqtMrHCjm4BYmRe/pub?output=csv";
const REFRESH_MS = 60 * 1000;           // refresh every 60s
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ====== ELEMENTS ======
const grid = document.getElementById('grid');
const updated = document.getElementById('updated');
const offlineBadge = document.getElementById('offline');

// ====== CSV PARSER (handles quoted commas) ======
function csvToRows(text) {
  return text.trim().split(/\r?\n/).map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cells.push(cur); cur = ''; } else { cur += c; }
    }
    cells.push(cur);
    return cells.map(s => s.trim());
  });
}

// ====== HELPERS ======
function groupBy(arr, key) {
  const m = new Map();
  for (const row of arr) {
    const k = row[key] || "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(row);
  }
  return m;
}
function relativeTime(t){
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
let lastUpdateT = Date.now();
setInterval(()=>{ updated.textContent = `Updated ${relativeTime(lastUpdateT)}`; }, 15000);

// ====== SAFE RENDER (no innerHTML for data fields) ======
function render(data) {
  grid.innerHTML = '';
  const byCat = groupBy(data, 'Category');
  for (const [cat, items] of byCat) {
    if (cat) {
      const catEl = document.createElement('div');
      catEl.className = 'category';
      catEl.textContent = cat; // SAFE
      grid.appendChild(catEl);
    }
    for (const it of items) {
      const inStock = (it['In Stock'] || '').toString().toLowerCase();
      if (inStock === 'false') continue;

      const card = document.createElement('div');
      card.className = 'card';

      const row = document.createElement('div');
      row.className = 'item';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = it['Item'] || ''; // SAFE

      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = it['Price'] || ''; // SAFE

      row.appendChild(name);
      row.appendChild(price);
      card.appendChild(row);

      const noteVal = it['Notes/Emoji'];
      if (noteVal) {
        const note = document.createElement('div');
        note.className = 'note';
        note.textContent = noteVal; // SAFE
        card.appendChild(note);
      }

      grid.appendChild(card);
    }
  }
}

// ====== CACHE HELPERS ======
function loadCached() {
  try {
    const cached = JSON.parse(localStorage.getItem('lastData') || 'null');
    if (!cached) return null;
    if (Date.now() - cached.t > CACHE_TTL_MS) return null;
    return cached;
  } catch { return null; }
}
function saveCache(items) {
  try { localStorage.setItem('lastData', JSON.stringify({ t: Date.now(), items })); }
  catch {}
}

// ====== FETCH & UPDATE LOOP ======
async function fetchAndRender() {
  try {
    const res = await fetch(SHEET_CSV_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.statusText);
    const text = await res.text();
    const rows = csvToRows(text);
    const headers = rows[0];
    const items = rows.slice(1).map(r =>
      Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))
    );
    render(items);
    lastUpdateT = Date.now();
    updated.textContent = `Updated ${new Date(lastUpdateT).toLocaleString()}`;
    saveCache(items);
    offlineBadge.style.display = 'none';
  } catch (e) {
    const cached = loadCached();
    if (cached) {
      render(cached.items);
      updated.textContent = `Offline — last update ${new Date(cached.t).toLocaleString()}`;
      offlineBadge.style.display = 'block';
    } else {
      updated.textContent = 'Failed to load data';
    }
  }
}

fetchAndRender();
setInterval(fetchAndRender, REFRESH_MS);
