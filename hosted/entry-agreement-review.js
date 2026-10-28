export function entryAgreementError({wording,reference,confirmed}){
 if(!String(wording??'').trim())return 'The host agreement wording is missing. Open Premium builder, complete Host\u2019s waiver and Save premium draft. Then return here to review pricing. The agreement name/version is only a label.';
 if(/DRAFT\s+PLACEHOLDER/i.test(wording))return 'Replace the placeholder wording in Premium builder under Host\u2019s waiver, then save the premium draft.';
 if(!String(reference??'').trim()||String(reference).trim().length>200)return 'Enter a Reviewed agreement name / version (1–200 characters), for example Entry Agreement v1. The example placeholder is not a saved answer.';
 if(confirmed!==true)return 'Check I reviewed the agreement, each fee basis, FEO availability and event capacities before saving.';
 return '';
}
