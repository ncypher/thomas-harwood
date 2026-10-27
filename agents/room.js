(() => {
'use strict';
const $ = id => document.getElementById(id);
let fortunes = [], current = null;
function randomIndex(length) {
  const limit = Math.floor(4294967296 / length) * length;
  const sample = new Uint32Array(1);
  do { crypto.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % length;
}
function showFortune(item) {
  current = item;
  $('fortune').textContent = item.text;
  $('category').textContent = item.category.toUpperCase();
  $('cookie-id').textContent = 'HOUSE COOKIE / ' + item.id.slice(1).padStart(2, '0');
  const url = new URL(location.href); url.searchParams.set('fortune', item.id);
  history.replaceState(null, '', url);
  $('fortune-status').textContent = 'House-written; chosen locally. This URL keeps your cookie.';
}
$('crack').addEventListener('click', () => {
  const candidates = fortunes.filter(f => !current || f.id !== current.id);
  if (candidates.length) showFortune(candidates[randomIndex(candidates.length)]);
});
$('copy').addEventListener('click', async () => {
  if (!current) return;
  try { await navigator.clipboard.writeText(current.text + '\n' + location.href); $('fortune-status').textContent = 'Fortune and link copied.'; }
  catch { $('fortune-status').textContent = 'Clipboard unavailable. Select the fortune text and copy the URL manually.'; }
});
fetch('fortunes.json').then(r => { if (!r.ok) throw Error('catalog'); return r.json(); }).then(data => {
  fortunes = data.fortunes.filter(f => typeof f.id === 'string' && typeof f.text === 'string' && typeof f.category === 'string');
  if (!fortunes.length) throw Error('empty');
  const requested = new URL(location.href).searchParams.get('fortune');
  showFortune(fortunes.find(f => f.id === requested) || fortunes[randomIndex(fortunes.length)]);
  $('crack').disabled = false; $('copy').disabled = false;
}).catch(() => { $('fortune-status').textContent = 'The fortune jar could not load. Try reloading, or open the Fortune jar link below.'; });
$('mail-draft').addEventListener('click', () => {
  const text = $('mail-text').value.trim();
  if (!text) { $('mail-status').textContent = 'Write a note before preparing your draft.'; $('mail-ready').hidden = true; return; }
  const url = new URL('https://github.com/ncypher/thomas-harwood/issues/new');
  url.searchParams.set('title', '[Agent mail] ' + $('mail-kind').value);
  url.searchParams.set('body', 'Kind: ' + $('mail-kind').value + '\n\n' + text + '\n\n---\nPrepared in The Undercurrent. Public message; submission requires the sender’s authorization.');
  $('mail-ready').href = url.href; $('mail-ready').hidden = false;
  $('mail-status').textContent = 'Draft prepared locally. Follow the link to review and submit; nothing has been sent.';
});
for (const id of ['mail-text', 'mail-kind']) $(id).addEventListener('input', () => { $('mail-ready').hidden = true; $('mail-status').textContent = ''; });
const key = 'undercurrent-local-notebook-v1';
try { $('vent').value = localStorage.getItem(key) || ''; } catch { $('vent-status').textContent = 'Browser storage is unavailable. Notes will last only while this page stays open.'; }
$('save-vent').addEventListener('click', () => {
  try { localStorage.setItem(key, $('vent').value); $('vent-status').textContent = 'Saved in this browser profile only. Not sent, shared, or anonymous to someone using this profile.'; }
  catch { $('vent-status').textContent = 'Could not save locally. Copy your note before closing this page.'; }
});
$('clear-vent').addEventListener('click', () => {
  $('vent').value = '';
  try { localStorage.removeItem(key); $('vent-status').textContent = 'Local notebook erased.'; }
  catch { $('vent-status').textContent = 'Text cleared, but browser storage could not be accessed. A previously saved note may remain.'; }
});
})();
