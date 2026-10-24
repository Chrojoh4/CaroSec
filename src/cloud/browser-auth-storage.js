export function browserAuthStorage(tab,shared,{now=()=>Date.now()}={}){
 const verifierKey=key=>key==='caro-staff-session-code-verifier'||key==='caro-staff-session-flows-code-verifier'||/^caro-staff-session-flow-[A-Za-z0-9_-]{8,64}-code-verifier$/.test(key);
 const prefix='caro-pkce:';
 return {
  getItem(key){
   if(!verifierKey(key))return tab.getItem(key);
   try{const raw=shared.getItem(prefix+key);if(raw){const item=JSON.parse(raw);if(typeof item.value==='string'&&Number.isFinite(item.expiresAt)&&item.expiresAt>now())return item.value;shared.removeItem(prefix+key);}}catch{}
   return tab.getItem(key);
  },
  setItem(key,value){
   if(!verifierKey(key)){tab.setItem(key,value);return;}
   try{shared.setItem(prefix+key,JSON.stringify({value,expiresAt:now()+60*60*1000}));tab.removeItem(key);}catch{tab.setItem(key,value);}
  },
  removeItem(key){tab.removeItem(key);if(verifierKey(key))try{shared.removeItem(prefix+key);}catch{}}
 };
}
