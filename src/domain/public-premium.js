import {escapeHtml as h,money} from './premium.js';

// Public pages accept only the dedicated approved-public RPC projection.
export function publicPremiumHtml(value){
 if(value?.kind!=='public_entry_edition'||value.publicationReady!==true||!value.configuration||!Array.isArray(value.configuration.events))throw new Error('Published trial is unavailable.');
 const c=value.configuration,p=value.content||{};
 const policies=[['intro','Welcome'],['timing','Schedule'],['dayOf','Day-of entries'],['orderNote','Running order'],['payment','Payment instructions'],['confirmations','Confirmations'],['facilities','Facilities'],['accommodations','Accessibility'],['awards','Awards'],['moveups','Move-ups'],['refunds','Withdrawals and refunds'],['siteRules','Site rules'],['waiver','Host agreement']];
 const sections=policies.filter(([key])=>p[key]).map(([key,title])=>`<section><h2>${h(title)}</h2><p class="preserve-lines">${h(p[key])}</p></section>`).join('');
 const rows=c.events.map(e=>`<tr><td>${h(e.round)}</td><td>${h(e.dayId)}</td><td>${h(e.format)} · ${h(e.level)}<br>${h((e.levels||[]).join(', '))}${e.exercises?.length?'<br>'+h(e.exercises.map(x=>x.name).join(' · ')):''}</td><td>${h(e.judge)}</td><td>${h(money(e.fee.cents))}<br>per ${h(e.basis)}<br>${e.feoFee?'FEO: '+h(money(e.feoFee.cents)):'FEO not offered'}</td></tr>`).join('');
 return `<article class="published-premium"><h1>${h(c.title)}</h1><p>Hosted by ${h(c.host)} · CARO trial ${h(c.trialNumber)}</p><p>${h(c.date)} to ${h(c.endDate)} · ${h(c.timezone)}</p><p><strong>${h(c.venue)}</strong><br>${h(c.address)}</p><p>Secretary: ${h(c.secretary)} · ${h(c.email)}</p><p>Entries open ${h(c.opens)} and close ${h(c.closes)}, in ${h(c.timezone)}.</p><p>Published edition ${h(value.version)} · Agreement ${h(c.premiumVersion)}</p><section><h2>Offered events and entry fees (CAD)</h2><div class="table-scroll"><table><thead><tr><th>Round</th><th>Date</th><th>Class and offerings</th><th>Judge</th><th>Fee</th></tr></thead><tbody>${rows}</tbody></table></div></section>${sections}</article>`;
}
