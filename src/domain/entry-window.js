import {dateInZone,validCalendarDate} from './date-time.js';
const cache=new Map();
function midnight(day,zone){
 const key=day+'|'+zone;if(cache.has(key))return cache.get(key);
 let low=Date.parse(day+'T00:00:00Z')-36*3600000,high=low+72*3600000;
 while(high-low>1){const mid=Math.floor((low+high)/2);if(dateInZone(new Date(mid).toISOString(),zone)<day)low=mid;else high=mid;}
 cache.set(key,high);return high;
}
export function entryWindow(config,now=Date.now()){
 if(!validCalendarDate(config.opens)||!validCalendarDate(config.closes)||config.closes<config.opens)return {phase:'unavailable',text:'Entry dates need confirmation. Please contact the host.'};
 const open=midnight(config.opens,config.timezone),next=new Date(Date.parse(config.closes+'T00:00:00Z')+86400000).toISOString().slice(0,10),close=midnight(next,config.timezone),time=typeof now==='number'?now:Date.parse(now);
 if(time<open){let seconds=Math.max(0,Math.ceil((open-time)/1000));const days=Math.floor(seconds/86400);seconds%=86400;const hours=Math.floor(seconds/3600);seconds%=3600;const minutes=Math.floor(seconds/60);seconds%=60;return {phase:'before',text:'Entries are not being accepted yet. Please check back in '+days+' days, '+hours+' hours, '+minutes+' minutes, '+seconds+' seconds.',opensAt:open};}
 return time>=close?{phase:'closed',text:'Entries are closed. Please contact the trial secretary with any questions.'}:{phase:'open',text:'Online entries are open. Complete the form below.'};
}
