"""Private draft price defaults; never changes an entry or its frozen terms."""
import re
KINDS=('regular','feo','team','brace','working','custom')
def fee_kind(fee):
 if fee.get('kind') in KINDS:return fee['kind']
 label=str(fee.get('label') or '').lower().strip()
 if re.search(r'\bfeo\b|exhibition',label):return 'feo'
 for kind in ('team','brace','working'):
  if re.search(r'\b'+kind+r'\b',label):return kind
 if re.fullmatch(r'(regular|competitive)( rally)?( entry)?( fee)?',label):return 'regular'
 return 'custom'
def draft_fee_defaults(event,fees,saved=None):
 def unique(kind):
  found=[f for f in fees if fee_kind(f)==kind]
  return found[0] if len(found)==1 else None
 def match(old):
  found=[f for f in fees if old and f.get('label')==old.get('label') and f.get('unit')==old.get('unit')]
  return found[0] if len(found)==1 else None
 kind={'Working':'working','Team':'team','Brace':'brace'}.get(event['format'],'regular')
 fee=match(saved.get('fee')) if saved else unique(kind)
 global_feo=unique('feo')
 feo=match(saved.get('feoFee')) if saved else global_feo if global_feo and global_feo.get('offered') is True else None
 unit=str((fee or {}).get('unit') or '').lower()
 basis='exercise' if event['format']=='Working' else 'dog' if event['format']=='Regular' else 'entry' if re.search(r'per (team|brace|event|entry|group)',unit) else 'dog' if re.search(r'per (participating )?dog',unit) else ''
 if re.search(r'confirm|review|not configured',unit) and not (saved or {}).get('basis'):basis=''
 return {'fee':fee,'feoFee':feo,'basis':saved.get('basis') if saved and saved.get('basis') else basis,'capacity':saved.get('capacity',50) if saved else 50}
