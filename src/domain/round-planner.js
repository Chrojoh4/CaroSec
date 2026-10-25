import {validCalendarDate} from './date-time.js';
export const roundClassKey=e=>e.level+'|'+e.format;
export function trialDayKeys(start,end,events=[]){
 const keys=new Set(events.map(e=>e.dayId));
 if(validCalendarDate(start)&&validCalendarDate(end)&&end>=start&&(Date.parse(end)-Date.parse(start))/86400000<=30){for(let date=Date.parse(start);date<=Date.parse(end);date+=86400000)keys.add(new Date(date).toISOString().slice(0,10));}
 return [...keys].sort((a,b)=>String(a).localeCompare(String(b)));
}
export function dayClasses(events,day,{contiguous=false}={}){
 const groups=[];
 for(const event of events.filter(e=>e.dayId===day)){const key=roundClassKey(event);let group=contiguous?groups.at(-1):groups.find(g=>g.key===key);if(!group||group.key!==key){group={key,level:event.level,format:event.format,events:[]};groups.push(group);}group.events.push(event);}
 return groups;
}
export function orderedDraftRounds(events){return trialDayKeys('','',events).flatMap(day=>dayClasses(events,day).flatMap(g=>g.events));}
export function reorderDayClass(events,day,key,{direction,before,targetKey}={}){
 const groups=dayClasses(events,day),index=groups.findIndex(g=>g.key===key);if(index<0)return events;
 let target=targetKey!==undefined?groups.findIndex(g=>g.key===targetKey):before===undefined?index+direction:groups.findIndex(g=>g.key===before);if(target<0||target>=groups.length||target===index)return events;
 const [moving]=groups.splice(index,1);if(before!==undefined&&target>index)target--;groups.splice(target,0,moving);
 const days=trialDayKeys('','',events);return days.flatMap(d=>d===day?groups.flatMap(g=>g.events):events.filter(e=>e.dayId===d));
}
export function setClassRoundCount(events,day,level,format,count,idFactory){
 if(!Number.isInteger(count)||count<1||count>150)throw new Error('Choose between 1 and 150 rounds.');
 const old=dayClasses(events,day).find(g=>g.key===roundClassKey({level,format})),current=old?.events||[];
 if(events.length-current.length+count>150)throw new Error('A trial can contain at most 150 rounds.');
 const next=current.slice(0,count);while(next.length<count)next.push({id:idFactory(),dayId:day,level,format,stream:'',judge:'',exercises:''});
 const groups=dayClasses(events,day);if(old)groups[groups.findIndex(g=>g.key===old.key)]={...old,events:next};else groups.push({key:roundClassKey({level,format}),level,format,events:next});
 const days=trialDayKeys('','',[...events,...next]);return days.flatMap(d=>d===day?groups.flatMap(g=>g.events):events.filter(e=>e.dayId===d));
}
