import {api,mountEntryForm} from '/entry-form.js';
import {escapeHtml as e,money,dateLabel} from '/premium.js';
const root=document.querySelector('#public-entry'),params=new URLSearchParams(location.search);
try {
  if(params.has('receipt')) {
    const value=await api('/api/receipt?token='+encodeURIComponent(params.get('receipt')));
    root.innerHTML=`<section class="receipt-card"><div class="eyebrow">YOUR ENTRY RECEIPT</div><h1>${e(value.dogName)}’s entry</h1><p>Status: ${e(value.status)} · Quote: ${money(value.amountCents)}</p><p>Acceptance and payment confirmation come from the secretary. Keep this private receipt link.</p></section>`;
  } else {
    const trial=await api('/api/public-trial?trial='+encodeURIComponent(params.get('trial')||''));
    root.innerHTML=`<div class="public-entry-hero"><div class="eyebrow">${e(trial.host)} · ${e(trial.trialNumber||'SAMPLE TRIAL')}</div><h1>${e(trial.title)}</h1><p>${e(dateLabel(trial.date))} · ${e(trial.venue)}</p><div class="public-entry-links"><a class="button secondary" href="/api/entry-form?trial=${trial.id}">Download fillable entry PDF ↓</a><span>${e(trial.email)}</span></div></div><div class="sample-note">${trial.fictional?'Fictional trial · sample policies and prices · test entries only':'Local preview · submissions are stored on this computer'}</div><div id="online-entry-form"></div>`;
    mountEntryForm(document.querySelector('#online-entry-form'),trial,{onSubmitted:async model=>{
      const {result}=await api('/api/entries',model);
      const url=new URL('/entry',location.origin);url.searchParams.set('receipt',result.receiptToken);
      root.innerHTML=`<section class="receipt-card"><div class="eyebrow">ENTRY RECEIVED</div><h1>A good day starts here.</h1><p>${e(result.dogName)}’s submission is pending secretary review.</p><strong>${money(result.amountCents)} CAD</strong><p>${e(trial.confirmations)}</p><a href="${e(url.href)}">Keep this private receipt link</a><p>No payment was taken and no email was automatically sent.</p></section>`;
    }});
  }
}catch(error){root.innerHTML=`<section class="receipt-card"><h1>Entry form unavailable</h1><p>${e(error.message)}</p><a href="/">Return to trial workspace</a></section>`;}
