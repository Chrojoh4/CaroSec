// Store plain positive decimal strings accepted by the database, without whitespace.
export function normalizeRingDimension(value){
 const text=String(value??'').trim();
 if(!/^(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(text))return text;
 return text.startsWith('.')?'0'+text:text.endsWith('.')?text.slice(0,-1):text;
}
export function ringDimensionError(planning={}){
 for(const [key,label] of [['ringWidth','Ring width'],['ringLength','Ring length']]){
  const value=normalizeRingDimension(planning[key]);
  if(!/^[0-9]+(?:\.[0-9]+)?$/.test(value)||!Number.isFinite(Number(value))||Number(value)<=0)return label+' must be a number greater than zero in feet (for example, 50).';
 }
 return '';
}
