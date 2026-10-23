import {timezoneLabel} from './date-time.js';
export const money = cents => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function sourceKey(draft) {
  return JSON.stringify(draft); // Full content fingerprint; no cryptographic claims.
}
export function validatePremium(draft) {
  const errors = [];
  for (const [key, label] of Object.entries({ title: 'Trial name', host: 'Host', date: 'Trial date', timezone: 'Timezone', venue: 'Venue', address: 'Address', secretary: 'Secretary', email: 'Contact email', chair: 'Chairperson', opens: 'Opening date', closes: 'Closing date', payment: 'Payment instructions', refunds: 'Refund policy', moveups: 'Move-up policy', waiver: 'Reviewed agreement', confirmations: 'Confirmation policy' })) {
    if (typeof draft[key] !== 'string' || !draft[key].trim()) errors.push(`${label} is required.`);
  }
  if (!/^\S+@\S+\.\S+$/.test(draft.email ?? '')) errors.push('Enter a valid contact email.');
  for (const key of ['date', 'opens', 'closes']) {
    const value = draft[key];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) errors.push(`Enter a valid ${key} date.`);
  }
  if (draft.opens > draft.closes) errors.push('Entries cannot open after they close.');
  if (draft.closes > draft.date && (!draft.allowLate || !draft.dayOf?.trim())) errors.push('Closing after the trial date requires an explicitly enabled late/day-of entry policy.');
  try { new Intl.DateTimeFormat('en-CA', { timeZone: draft.timezone }).format(); } catch { errors.push('Enter a valid IANA timezone.'); }
  if (!safeUrl(draft.entryUrl)) errors.push('A valid online entry URL is required.');
  if (!safeUrl(draft.entryPdfUrl)) errors.push('A valid downloadable email / paper entry PDF URL is required.');
  if (!draft.events?.length) errors.push('Add at least one offered event.');
  for (const event of draft.events ?? []) {
    if (!event.judge?.trim()) errors.push(`Round ${event.round}: assign a judge.`);
    if (!event.level?.trim()) errors.push(`Round ${event.round}: choose a class.`);
    if (!['Novice', 'Intermediate', 'Advanced', 'Excellent', 'Versatility', 'Versatility Excellent', 'Working'].includes(event.level)) errors.push(`Round ${event.round}: unknown class.`);
    if ((event.format === 'Working') !== (event.level === 'Working')) errors.push(`Round ${event.round}: Working class and format must match.`);
    if (!['Regular', 'Team', 'Brace', 'Working'].includes(event.format)) errors.push(`Round ${event.round}: choose a format.`);
    if (event.format === 'Working' && !event.exercises?.trim()) errors.push(`Round ${event.round}: list Working exercises and levels.`);
  }
  if (new Set((draft.events ?? []).map(event => event.id)).size !== (draft.events ?? []).length || (draft.events ?? []).some((event, index) => event.round !== index + 1)) errors.push('Event IDs must be unique and official rounds must be numbered consecutively.');
  if (!draft.fees?.length) errors.push('Add at least one fee.');
  for (const fee of draft.fees ?? []) {
    if (!fee.label?.trim() || !fee.unit?.trim() || !Number.isSafeInteger(fee.cents) || fee.cents < 0) errors.push('Every fee needs a label, pricing unit and nonnegative CAD amount.');
  }
  if (!draft.approved || !draft.trialNumber?.trim()) errors.push('Record CARO approval and an assigned trial number before publication.');
  if (!draft.approvalEvidence?.trim()) errors.push('Record approval evidence or confirmation reference.');
  if (!draft.reviewed) errors.push('Complete the secretary review before publication.');
  if (draft.fictional) errors.push('Replace fictional sample data and turn off sample mode before creating an approved edition.');
  if (/DRAFT PLACEHOLDER/i.test(draft.waiver ?? '')) errors.push('Replace the placeholder agreement with reviewed host wording.');
  return [...new Set(errors)];
}
export function publishEdition(draft, editions, now = new Date().toISOString()) {
  const errors = validatePremium(draft);
  if (errors.length) throw new Error(errors.join('\n'));
  if (editions.some(edition => edition.sourceKey === sourceKey(draft))) throw new Error('This version has already been saved.');
  return { version: editions.length + 1, createdAt: now, sourceKey: sourceKey(draft), snapshot: structuredClone(draft) };
}
export function dateLabel(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Date to be confirmed';
  return new Intl.DateTimeFormat('en-CA', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}
export function venueMapUrl(address){return typeof address==='string'&&address.trim()?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address.trim()):'';}
export function renderPremium(draft, { version = null, standalone = false, secretaryPreview = false, secretaryLinks = null } = {}) {
  const e = escapeHtml;
  const events = draft.events ?? [];
  // Balanced row groups prevent a single last event being stranded on a new page.
  const groupCount = Math.max(1, Math.ceil(events.length / 5));
  const eventGroups = [];
  let offset = 0;
  for (let index = 0; index < groupCount; index++) {
    const size = Math.floor(events.length / groupCount) + (index < events.length % groupCount ? 1 : 0);
    eventGroups.push(events.slice(offset, offset + size)); offset += size;
  }
  const url = safeUrl(draft.entryUrl);
  const pdfUrl = safeUrl(draft.entryPdfUrl);
  const proofOnline=safeUrl(secretaryLinks?.online),proofPaper=safeUrl(secretaryLinks?.paper);
  const mapUrl=venueMapUrl(draft.address),addressHtml=mapUrl?`<a href="${e(mapUrl)}" target="_blank" rel="noopener">${e(draft.address)} ↗</a>`:e(draft.address);
  const text = value => e(value).replace(/\n/g, '<br>');
  const section = (title, content, flowing = false) => `<section class="premium-section${flowing ? ' premium-section--flowing' : ''}"><h2>${title}</h2>${content}</section>`;
  const body = `<article class="premium theme-${['forest', 'ocean', 'berry'].includes(draft.theme) ? draft.theme : 'forest'}">
    <div class="premium-ribbon"><span>${draft.fictional ? 'FICTIONAL SAMPLE · NOT AN ACTUAL TRIAL' : 'CANADIAN ASSOCIATION OF RALLY OBEDIENCE'}</span><span>${version ? `EDITION ${version}` : 'PRIVATE DRAFT'}</span></div>
    <header class="premium-hero"><div class="premium-host">${e(draft.host || 'Your host club')} presents</div><h1>${e(draft.title || 'Your next great day in the ring.')}</h1><p class="premium-intro">${text(draft.intro)}</p><div class="hero-meta"><span>↗ ${e(dateLabel(draft.date))}${draft.endDate && draft.endDate !== draft.date ? ` – ${e(dateLabel(draft.endDate))}` : ''}</span><span>⌖ ${e(draft.venue)}</span></div><div class="sanction">${draft.approved && draft.trialNumber ? `Sanctioned Rally Trial · ${e(draft.trialNumber)}` : 'Approval pending · private preview'}</div></header>
    <div class="premium-body"><div class="welcome-strip"><span>A little teamwork.<br><strong>A lot to celebrate.</strong></span><span>Hosted by ${e(draft.host)}<br>${addressHtml}</span></div>
    <div class="entry-banner"><div><small>ENTRIES OPEN</small><strong>${e(dateLabel(draft.opens))}</strong></div><div><small>ENTRIES CLOSE</small><strong>${e(dateLabel(draft.closes))}</strong></div><div><small>ENTRY LIMIT</small><strong>${e(draft.capacity || 'See entry information')}</strong></div></div><p class="fineprint">All entry dates and trial-day times are in ${e(timezoneLabel(draft.timezone))}. ${e(draft.dayOf)}</p>
    ${section('01 <span>Your day in the ring</span>', `<p>${text(draft.timing)}</p><div class="table-scroll"><table><thead><tr><th>Official round</th><th>Event / format</th><th>Stream / levels</th><th>Judge</th></tr></thead>${eventGroups.map(group => '<tbody>' + group.map(row => `<tr><td><span class="round-pill">${e(row.round)}</span></td><td><strong>${e(row.level)}</strong><br><small>${e(row.format)}${draft.endDate && draft.endDate !== draft.date ? ` · ${e(row.dayId || 'Date to confirm')}` : ''}</small>${row.exercises ? `<br><small>${e(row.exercises)}</small>` : ''}</td><td>${e(row.stream)}</td><td>${e(row.judge)}</td></tr>`).join('') + '</tbody>').join('')}</table></div><p class="fineprint">Official round numbers identify events; ${e(draft.orderNote || 'the final running schedule will be confirmed by the secretary.')}</p>`, events.length > 8)}
    ${section('02 <span>Entries & fees</span>', `<div class="fee-grid">${(draft.fees ?? []).map(fee => `<div class="fee-tile"><span>${e(fee.label)}</span><strong>${money(fee.cents)}</strong><small>${e(fee.unit)}</small></div>`).join('')}</div><p>${text(draft.payment)}</p><div class="policy-note"><strong>Entry confirmations</strong><p>${text(draft.confirmations)}</p></div>${url ? `<a class="entry-link" href="${e(url)}" target="_blank" rel="noopener">Enter online <span>↗</span></a>` : ''}${pdfUrl ? `<a class="entry-link entry-link-secondary" href="${e(pdfUrl)}" target="_blank" rel="noopener">Download entry form (PDF) <span>↓</span></a><p class="fineprint">Complete electronically and email to ${e(draft.email)}, or print and complete by hand.</p>` : '<p class="fineprint">Paper / email entry form: the download link becomes available after CARO approval, reviewed entry pricing and publication. This private draft does not open entries.</p>'}`)}
    ${secretaryPreview||proofOnline||proofPaper?`<section class="premium-section"><h2>Secretary testing links</h2><p>Private proof only — sign in as authorized trial staff. These links do not open entries.</p><p><a class="entry-link" href="${e(proofOnline||'#secretary-online-entry-preview')}" ${proofOnline?'target="_blank" rel="noopener"':''}>Preview online entry form (read-only) ↗</a></p><p><a class="entry-link entry-link-secondary" href="${e(proofPaper||'#secretary-paper-entry-preview')}" ${proofPaper?'target="_blank" rel="noopener"':''}>Download fillable paper / email entry PDF — PRIVATE PROOF ↓</a></p></section>`:''}
    ${section('03 <span>Come prepared, feel welcome</span>', `<div class="two-column"><div><h3>The venue</h3><p><strong>${e(draft.venue)}</strong><br>${addressHtml}</p><p>${text(draft.facilities)}</p></div><div><h3>Access & accommodations</h3><p>${text(draft.accommodations)}</p><h3>Awards</h3><p>${text(draft.awards)}</p></div></div>`)}
    ${section('04 <span>The details that matter</span>', `<div class="two-column"><div><h3>Move-ups</h3><p>${text(draft.moveups)}</p><h3>Withdrawals & refunds</h3><p>${text(draft.refunds)}</p></div><div><h3>Site etiquette</h3><p>${text(draft.siteRules)}</p><h3>Rules & eligibility</h3><p>This trial is conducted under CARO rules. Entrants are responsible for reviewing the current requirements and their chosen classes.</p><a href="https://canadianrallyo.ca/handbook-signs/" target="_blank" rel="noopener">Read the official CARO handbooks ↗</a></div></div><details class="agreement" open><summary>Entry agreement</summary><p>${text(draft.waiver)}</p></details>`)}
    <footer class="premium-footer"><div><small>YOUR TRIAL SECRETARY</small><h3>${e(draft.secretary)}</h3><span>${e(draft.email)}</span></div><div><small>TRIAL CHAIRPERSON</small><h3>${e(draft.chair)}</h3><span>${e(draft.host)}</span></div><p>Good dogs. Great teamwork. A day worth wagging about.</p></footer></div></article>`;
  return standalone ? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(draft.title)} · Premium</title></head><body>${body}</body></html>` : body;
}
