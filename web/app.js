import { timestampLabel } from '/date-time.js';
import { sampleDraft } from '/sample.js';
import { renderPremium, validatePremium, publishEdition, sourceKey, escapeHtml as e } from '/premium.js';
import { SHARED_KEYS, createTrialWorkspace, hydrateTrial, premiumFromTrial, syncTrialFromPremium } from '/trial-workspace.js';
import { createDesk } from '/desk.js';
import { createTrialWizard } from '/trial-wizard.js';
const KEY = 'caro-premium-studio-v1';
let draft = sampleDraft(), editions = [], section = 'details', view = 'studio', template = null, trial, page = 'application';
let failedStored = null, storedRaw = null, canSave = true;
const $ = selector => document.querySelector(selector);
function validateImport(data) {
  const baseline = sampleDraft();
  if (!data || typeof data !== 'object' || !data.draft || !Array.isArray(data.editions)) throw new Error('Not a CARO project backup.');
  const check = item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid premium.');
    for (const [key, value] of Object.entries(baseline)) {
      if (typeof item[key] !== typeof value || (Array.isArray(value) && !Array.isArray(item[key]))) throw new Error(`Invalid field: ${key}`);
    }
    if (item.events.length > 150 || item.fees.length > 50) throw new Error('Too many rows.');
    for (const event of item.events) if (!['id', 'level', 'format', 'stream', 'judge', 'exercises'].every(key => typeof event[key] === 'string') || !Number.isInteger(event.round)) throw new Error('Invalid event row.');
    for (const fee of item.fees) if (typeof fee.label !== 'string' || typeof fee.unit !== 'string' || !Number.isSafeInteger(fee.cents) || fee.cents < 0) throw new Error('Invalid fee row.');
  };
  check(data.draft);
  for (const edition of data.editions) {
    check(edition.snapshot);
    if (!Number.isInteger(edition.version) || typeof edition.createdAt !== 'string' || typeof edition.sourceKey !== 'string') throw new Error('Invalid saved edition.');
  }
  return { ...data, trial: hydrateTrial(data.trial, data.draft) };
}
try {
  const stored = localStorage.getItem(KEY); storedRaw = stored;
  if (stored) { const parsed = JSON.parse(stored); if (parsed.draft.allowLate === undefined) parsed.draft.allowLate = false; for (const edition of parsed.editions ?? []) if (edition.snapshot.allowLate === undefined) edition.snapshot.allowLate = false; const data = validateImport(parsed); draft = data.draft; editions = data.editions; trial = data.trial; }
} catch {
  failedStored = storedRaw; canSave = !storedRaw;
  $('#storage-warning').hidden = false;
  $('#storage-warning').textContent = 'Saved data could not be loaded. The original is preserved. Backup project will download the original data; import a valid backup to resume saving.';
}
try { const value = localStorage.getItem(KEY + '-template'); if (value) template = JSON.parse(value); } catch { template = null; }
trial ??= createTrialWorkspace(draft);
draft = premiumFromTrial(trial, draft);
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
function save() {
  if (!canSave) { toast('Saving is paused to preserve unreadable data. Export the original backup and import a valid project.'); return; }
  try { localStorage.setItem(KEY, JSON.stringify({ draft, editions, trial })); $('#save-state').textContent = '✓ Draft saved locally'; }
  catch { $('#save-state').textContent = 'Not saved — export a backup'; toast('Browser storage is unavailable or full. Please export a backup.'); }
}
function field(key, label, type = 'text', hint = '') {
  return `<label class="field"><span>${label}</span>${type === 'textarea' ? `<textarea data-key="${key}" rows="3">${e(draft[key])}</textarea>` : `<input data-key="${key}" type="${type}" value="${e(draft[key])}">`}${hint ? `<small>${hint}</small>` : ''}</label>`;
}
const check = (key, label) => `<label class="check-field"><input type="checkbox" data-key="${key}" ${draft[key] ? 'checked' : ''}><span>${label}</span></label>`;
function renderEditor() {
  const intros = { details: ['The essentials', 'A warm welcome starts with the right details.'], events: ['A place for every team', 'Each row is one official event. Team and Brace are separate.'], fees: ['Simple, transparent pricing', 'Use explicit units so teams know exactly what they’re paying.'], policies: ['Clear expectations. Better days.', 'Review these details for your venue and current CARO rules.'], review: ['Ready for a final look?', 'Save a reviewed edition when every detail is in place.'] };
  let content = '';
  if (section === 'details') content = `${check('fictional', 'Fictional sample — clearly label this preview')}${field('title', 'Trial name')}${field('host', 'Hosting club')}${field('intro', 'Welcome message', 'textarea')}<div class="field-row">${field('date', 'Trial date', 'date')}${field('timezone', 'Timezone')}</div>${field('venue', 'Venue')}${field('address', 'Public venue address')}${field('secretary', 'Trial secretary')}${field('email', 'Public contact email', 'email')}${field('chair', 'Trial chairperson')}<div class="subheading">Entry window</div><div class="field-row">${field('opens', 'Opens', 'date')}${field('closes', 'Closes', 'date')}</div>${field('capacity', 'Entry limit')}${field('entryUrl', 'Online entry URL', 'url')}${field('timing', 'Check-in & start times', 'textarea')}`;
  if (section === 'events') content = `<div class="info-card">Draft event list · class combinations and judge authorizations still require verification. This editor does not finalize or submit a CARO application.</div>${draft.events.map((row, i) => `<div class="event-editor"><div class="row-heading"><strong>ROUND ${row.round}</strong><div><button class="icon-button" data-move="${i}" data-delta="-1" aria-label="Move round ${row.round} up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" data-move="${i}" data-delta="1" aria-label="Move round ${row.round} down" ${i === draft.events.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-button remove" data-remove-event="${i}" aria-label="Remove round ${row.round}">×</button></div></div><label class="field"><span>Class</span><select data-event="${i}" data-prop="level">${['Novice','Intermediate','Advanced','Excellent','Versatility','Versatility Excellent','Working'].map(v => `<option ${row.level === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><div class="field-row"><label class="field"><span>Format</span><select data-event="${i}" data-prop="format">${['Regular','Team','Brace','Working'].map(v => `<option ${row.format === v ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label class="field"><span>Stream / levels</span><input data-event="${i}" data-prop="stream" value="${e(row.stream)}"></label></div><label class="field"><span>Assigned judge</span><input data-event="${i}" data-prop="judge" value="${e(row.judge)}"></label>${row.format === 'Working' ? `<label class="field"><span>Offered exercises & levels</span><textarea data-event="${i}" data-prop="exercises">${e(row.exercises)}</textarea></label>` : ''}</div>`).join('')}<button class="button secondary wide" id="add-event">+ Add an event</button>${field('orderNote', 'Running-order note')}`;
  if (section === 'fees') content = `${draft.fees.map((fee, i) => `<div class="event-editor"><div class="row-heading"><strong>FEE ${i+1}</strong><button class="icon-button remove" data-remove-fee="${i}" aria-label="Remove fee ${i+1}">×</button></div><label class="field"><span>Label</span><input data-fee="${i}" data-prop="label" value="${e(fee.label)}"></label><div class="field-row"><label class="field"><span>Amount (CAD)</span><input type="number" min="0" step="0.01" data-fee="${i}" data-prop="cents" value="${(fee.cents / 100).toFixed(2)}"></label><label class="field"><span>Pricing unit</span><input data-fee="${i}" data-prop="unit" value="${e(fee.unit)}"></label></div></div>`).join('')}<button id="add-fee" class="button secondary wide">+ Add a fee</button>${field('payment', 'Payment instructions & taxes', 'textarea')}${field('confirmations', 'Entry confirmation policy', 'textarea')}`;
  if (section === 'policies') content = `${check('allowLate', 'Late/day-of entries are explicitly allowed')}${field('dayOf', 'Late / day-of entry policy', 'textarea')}${field('moveups', 'Move-ups', 'textarea')}${field('refunds', 'Withdrawals & refunds', 'textarea')}${field('facilities', 'Venue & facilities', 'textarea')}${field('accommodations', 'Accommodation requests', 'textarea')}${field('awards', 'Awards', 'textarea')}${field('siteRules', 'Site etiquette', 'textarea')}${field('waiver', 'Host-approved agreement', 'textarea', 'Replace the sample placeholder with wording approved by your host.')}`;
  if (section === 'review') {
    const errors = validatePremium(draft);
    const latest = editions.at(-1);
    content = `<div class="info-card">Saving an edition here is local only. Nothing is submitted to CARO or published online.</div>${field('trialNumber', 'Assigned CARO trial number')}${field('approvalEvidence', 'Approval confirmation / evidence reference')}${check('approved', 'CARO approval has been received and recorded')}${check('reviewed', 'I reviewed events, prices, policies and the agreement')}<div class="validation ${errors.length ? '' : 'ready'}"><strong>${errors.length ? `${errors.length} items to review` : 'Ready to save a reviewed edition'}</strong><ul>${errors.map(error => `<li>${e(error)}</li>`).join('')}</ul></div>${latest ? `<div class="info-card">Edition ${latest.version}: ${latest.sourceKey === sourceKey(draft) ? 'matches this draft.' : 'differs from this draft. Save a new edition after review.'}</div>` : ''}<button id="publish" class="button primary wide" ${errors.length ? 'disabled' : ''}>Save reviewed edition</button>`;
  }
  $('#editor').innerHTML = `<div class="section-intro"><h3>${intros[section][0]}</h3><p>${intros[section][1]}</p></div>${content}`;
  const owned = new Set([...SHARED_KEYS, 'trialNumber', 'approvalEvidence', 'approved']);
  $('#editor').querySelectorAll('[data-key]').forEach(node => { if (owned.has(node.dataset.key)) node.disabled = true; });
  $('#editor').querySelectorAll('[data-event], [data-move], [data-remove-event], #add-event').forEach(node => node.disabled = true);
  if (['details','events','review'].includes(section)) $('#editor').insertAdjacentHTML('afterbegin', '<div class="info-card">Trial details, events and sanction status come from your application. <button class="text-button" data-page="application">Edit trial application →</button></div>');
  document.querySelectorAll('[data-section]').forEach(button => button.classList.toggle('selected', button.dataset.section === section));
}
function renderPreview() {
  $('#premium-preview').innerHTML = renderPremium(draft);
  $('#theme').value = draft.theme;
  $('#edition-count').textContent = editions.length;
  $('.sample-note').textContent = draft.fictional ? 'Fictional sample data · private preview · no CARO submission' : 'Private draft preview · nothing published online';
}
function renderEditions() {
  $('#editions').innerHTML = `<div class="editions-heading"><h2>Your saved editions</h2><p>Frozen local snapshots. Changes to your draft never rewrite these editions.</p></div>${editions.length ? [...editions].reverse().map(edition => `<div class="edition-card"><div><span class="eyebrow">EDITION ${edition.version} · ${edition.version === editions.at(-1).version ? 'LATEST SAVED' : 'SUPERSEDED'}</span><h3>${e(edition.snapshot.title)}</h3><p>${e(edition.snapshot.trialNumber)} · ${e(timestampLabel(edition.createdAt,edition.snapshot.timezone))}</p></div><button class="button secondary" data-export-edition="${edition.version}">Download HTML ↓</button></div>`).join('') : '<div class="empty-state"><span>◷</span><h3>A great premium starts with a draft.</h3><p>Finish the review checklist to save your first edition.</p><button class="button primary" id="go-review">Review your premium</button></div>'}`;
}
function renderAll() { renderEditor(); renderPreview(); renderEditions(); if (page === 'application') wizard.render(); }
function updateReview() {
  const errors = validatePremium(draft);
  const panel = document.querySelector('.validation');
  panel.classList.toggle('ready', !errors.length);
  panel.innerHTML = `<strong>${errors.length ? `${errors.length} items to review` : 'Ready to save a reviewed edition'}</strong><ul>${errors.map(error => `<li>${e(error)}</li>`).join('')}</ul>`;
  document.querySelector('#publish').disabled = errors.length > 0;
}
function change() {
  try { trial = syncTrialFromPremium(trial, draft); } catch (error) { notifyTrialError(error); }
  draft = premiumFromTrial(trial, draft);
  draft.reviewed = false;
  save(); renderPreview();
  if (section === 'review') updateReview();
}
document.addEventListener('input', event => {
  const target = event.target;
  if (target.dataset.key) {
    const key = target.dataset.key;
    draft[key] = target.type === 'checkbox' ? target.checked : target.value;
    if (key === 'reviewed') { save(); updateReview(); renderPreview(); } else change();
  } else if (target.dataset.event !== undefined) {
    draft.events[Number(target.dataset.event)][target.dataset.prop] = target.value;
    if (target.dataset.prop === 'format') {
      const row = draft.events[Number(target.dataset.event)];
      if (row.format === 'Working') { row.level = 'Working'; row.stream = 'Rookie'; }
      else if (row.level === 'Working') row.level = 'Novice';
      renderEditor();
    }
    change();
  } else if (target.dataset.fee !== undefined) {
    if (target.dataset.prop === 'cents') {
      const cents = Math.round(Number(target.value) * 100);
      if (!Number.isSafeInteger(cents) || cents < 0) { target.setCustomValidity('Enter a nonnegative CAD amount.'); target.reportValidity(); return; }
      target.setCustomValidity(''); draft.fees[Number(target.dataset.fee)].cents = cents;
    } else draft.fees[Number(target.dataset.fee)][target.dataset.prop] = target.value;
    change();
  }
});
function download(name, content, mime) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function exportHtml(snapshot, version = null) {
  const css = await fetch('/styles.css').then(response => { if (!response.ok) throw new Error('Unable to load export styles'); return response.text(); });
  let html = renderPremium(snapshot, { version, standalone: true });
  html = html.replace('</head>', `<style>${css}</style></head>`);
  download(`caro-premium-${version ? `edition-${version}` : 'private-draft'}.html`, html, 'text/html');
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  try {
    if (button.dataset.page) showPage(button.dataset.page);
    if (button.dataset.section) { section = button.dataset.section; renderEditor(); }
    if (button.dataset.view) {
      showPage('premium');
      view = button.dataset.view; $('#studio').hidden = view === 'editions'; $('#editions').hidden = view !== 'editions';
      $('#studio').classList.toggle('preview-only', view === 'preview');
      document.querySelectorAll('[data-view]').forEach(node => node.classList.toggle('selected', node === button)); renderEditions();
    }
    if (button.dataset.removeEvent !== undefined) { draft.events.splice(Number(button.dataset.removeEvent), 1); renumber(); }
    if (button.dataset.move !== undefined) { const i = Number(button.dataset.move), j = i + Number(button.dataset.delta); if (j >= 0 && j < draft.events.length) [draft.events[i], draft.events[j]] = [draft.events[j], draft.events[i]]; renumber(); }
    if (button.dataset.removeFee !== undefined) { draft.fees.splice(Number(button.dataset.removeFee), 1); change(); renderEditor(); }
    if (button.id === 'add-event') { draft.events.push({ id: crypto.randomUUID(), round: draft.events.length + 1, level: 'Novice', format: 'Regular', stream: 'B', judge: '', exercises: '' }); change(); renderEditor(); }
    if (button.id === 'add-fee') { draft.fees.push({ label: '', cents: 0, unit: 'per dog / event' }); change(); renderEditor(); }
    if (button.id === 'backup') { download(failedStored ? 'caro-original-recovery.json' : 'caro-premium-project.json', failedStored || JSON.stringify({ draft, editions, trial }, null, 2), 'application/json'); toast('Project backup downloaded.'); }
    if (button.id === 'download') await exportHtml(draft);
    if (button.id === 'print') { document.querySelectorAll('.agreement').forEach(node => node.open = true); window.print(); }
    if (button.id === 'publish') { const edition = publishEdition(draft, editions); editions.push(edition); save(); renderAll(); toast(`Edition ${edition.version} saved locally. Nothing was published online.`); }
    if (button.id === 'template-save') {
      const keys = ['host','secretary','email','chair','theme','intro','payment','confirmations','facilities','accommodations','awards','moveups','refunds','siteRules','waiver','fees'];
      template = Object.fromEntries(keys.map(key => [key, structuredClone(draft[key])]));
      localStorage.setItem(KEY + '-template', JSON.stringify(template)); toast('Club template saved in this browser.');
    }
    if (button.id === 'template-load') {
      if (!template) return toast('Save a club template first.');
      // Validate merged template before applying local or restored content.
      const next = { ...draft, ...template, reviewed: false };
      validateImport({ draft: next, editions, trial }); trial = syncTrialFromPremium(trial, next); draft = premiumFromTrial(trial, next); save(); renderAll(); toast('Club template applied. Trial dates and events were kept.');
    }
    if (button.dataset.exportEdition) { const edition = editions.find(item => item.version === Number(button.dataset.exportEdition)); await exportHtml(edition.snapshot, edition.version); }
    if (button.id === 'go-review') { $('[data-view="studio"]').click(); section = 'review'; renderEditor(); }
  } catch (error) { toast(error.message); }
});
function renumber() { draft.events.forEach((row, index) => row.round = index + 1); change(); renderEditor(); }
$('#theme').addEventListener('change', event => { draft.theme = event.target.value; change(); });
$('#import').addEventListener('change', async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 3_000_000) throw new Error('Backup exceeds the 3 MB limit.');
    const data = validateImport(JSON.parse(await file.text()));
    if (!confirm('Replace this browser’s current project with the imported backup? Export your current project first if you need to keep it.')) return;
    canSave = true; failedStored = null; $('#storage-warning').hidden = true;
    trial = data.trial; draft = premiumFromTrial(trial, data.draft); editions = data.editions; save(); renderAll(); toast('Backup restored.');
  } catch (error) { toast(`Import failed: ${error.message}`); }
  finally { event.target.value = ''; }
});
function notifyTrialError(error) { toast(error.message); }
const wizard = createTrialWizard({
  root: $('#application-workspace'), getTrial: () => trial,
  onUpdate: next => { trial = next; draft = premiumFromTrial(trial, { ...draft, reviewed: false }); save(); renderEditor(); renderPreview(); },
  onPremium: () => showPage('premium'), notify: toast, download,
});
const desk = createDesk({ root: $('#secretary-desk'), getWorkspace: () => ({ trial, premium: draft, editions }), notify: toast, download, onPrepared: id => {
  const entry = new URL('/entry', location.origin); entry.searchParams.set('trial',id);
  const pdf = new URL('/api/entry-form', location.origin); pdf.searchParams.set('trial',id);
  draft.entryUrl=entry.href; draft.entryPdfUrl=pdf.href; draft.reviewed=false; save(); renderPreview();
} });
function showPage(next) {
  page = next;
  $('#application-workspace').hidden = page !== 'application';
  $('#secretary-desk').hidden = page !== 'desk';
  $('#premium-toolbar').hidden = page !== 'premium';
  $('#studio').hidden = page !== 'premium' || view === 'editions';
  $('#editions').hidden = page !== 'premium' || view !== 'editions';
  $('#breadcrumb').textContent = page === 'application' ? 'Trial application' : page === 'desk' ? 'Secretary desk' : 'Premium studio';
  $('#page-heading-copy').innerHTML = page === 'application'
    ? '<div class="eyebrow">A GREAT TRIAL STARTS HERE</div><h1>Plan the day. Bring teams together.</h1><p>Your application, events and premium. One connected trial record.</p>'
    : page === 'desk' ? '<div class="eyebrow">FROM FIRST ENTRY TO FINAL RIBBON</div><h1>Every team. Every round. Together.</h1><p>Entries, running orders, judge results and finances in one local trial desk.</p>' : '<div class="eyebrow">MAKE A GREAT FIRST IMPRESSION</div><h1>Your trial. Beautifully introduced.</h1><p>All the details teams need, in a premium they’ll want to read.</p>';
  document.querySelectorAll('[data-page]').forEach(button => { button.classList.toggle('active',button.dataset.page === page); button.classList.toggle('selected',button.dataset.page === page); });
  if (page === 'application') wizard.render(); else if (page === 'desk') desk.refresh(); else renderEditor();
}
window.addEventListener('storage', event => {
  if (event.key !== KEY || !event.newValue) return;
  try {
    const data = validateImport(JSON.parse(event.newValue));
    trial = data.trial; draft = premiumFromTrial(trial, data.draft); editions = data.editions;
    renderAll(); toast('Workspace updated from another tab.');
  } catch { toast('A different tab saved data that could not be loaded. Export a backup before continuing.'); }
});
renderAll(); showPage('application');
