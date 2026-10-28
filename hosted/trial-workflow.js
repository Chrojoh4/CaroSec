// Shared secretary order, adapted from the reference workflows without their competition rules.
export const trialWorkflow=[
 ['overview','Trial dashboard'],['application','Trial details & rounds'],['entry-settings','Classes, streams & fees'],
 ['premium','Premium builder'],['sanction','CARO submission & approval'],['entry-preview','Online entry form (preview)'],['entry-paper-proof','Paper / email entry form (PDF)'],
 ['entries','Entries & waitlist'],['manual-intake','Add paper / email entry'],['finance','Financial summary'],
 ['running-order','Running orders'],['judge-sheets','Judge score sheets'],['score-entry','Score entry & sign-off'],
 ['reports','Results & CARO closeout'],['judge-amendments','Judge replacements'],['journal','Activity journal']
].map(([key,label])=>({key,label}));
