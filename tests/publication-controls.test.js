import test from 'node:test';import assert from 'node:assert/strict';import {publicationControls} from '../hosted/publication.js';
class Node{constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.disabled=false;this.checked=false;}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}replaceChildren(...nodes){this.children=nodes;}reportValidity(){return true;}addEventListener(name,callback){this.listeners[name]=callback;}}
const all=n=>[n,...n.children.flatMap(all)];
test('publication review stays actionable after the shared busy guard restores button states',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};let box,dirty=false,calls=0;
 try{
  const client={rpc:async()=>{calls++;return {data:{configuration:{title:'Example',timezone:'America/Vancouver',events:[]},content:{},judgeAmendments:[],reviewToken:'review'}};}};
  const action=async work=>{const saved=all(box).filter(n=>n.tag==='button').map(button=>({button,disabled:button.disabled}));for(const {button} of saved)button.disabled=true;try{await work();}catch{}finally{for(const {button,disabled} of saved)button.disabled=disabled;}};
  box=publicationControls({client,trial:{id:'trial',title:'Example'},action,message:()=>{},isCurrent:()=>true,isDirty:()=>dirty});
  const nodes=all(box),review=nodes.find(n=>n.textContent==='Review public premium'),publish=nodes.find(n=>n.textContent==='Publish reviewed premium');
  assert.equal(publish.disabled,false);await review.listeners.click();assert.equal(publish.disabled,false);assert.equal(calls,1);
  dirty=true;await review.listeners.click();assert.equal(publish.disabled,false);assert.equal(calls,1);
 }finally{globalThis.document=original;}
});
test('an outdated publication screen does not load a review',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};
 try{const box=publicationControls({client:{rpc:async()=>({data:{}})},trial:{id:'trial',title:'Example'},action:async work=>work(),message:()=>{},isCurrent:()=>false,isDirty:()=>false});const nodes=all(box);await nodes.find(n=>n.textContent==='Review public premium').listeners.click();assert.equal(nodes.find(n=>n.textContent==='Publish reviewed premium').disabled,false);}finally{globalThis.document=original;}
});

test('publish first loads a review and never silently publishes before confirmation',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};const calls=[];let warning='';
 try{const box=publicationControls({client:{rpc:async name=>{calls.push(name);return {data:{configuration:{title:'Example',timezone:'America/Vancouver',events:[]},content:{},reviewToken:'token'}};}},trial:{id:'trial',title:'Example'},action:async work=>{try{await work();}catch(e){warning=e.message;}},message:()=>{},isCurrent:()=>true,isDirty:()=>false});const publish=all(box).find(n=>n.textContent==='Publish reviewed premium');await publish.listeners.click();assert.deepEqual(calls,['caro_publication_preview']);await publish.listeners.click();assert.match(warning,/Check I reviewed/);assert.deepEqual(calls,['caro_publication_preview']);}finally{globalThis.document=original;}
});

test('confirmed premium publication includes scheduled online entry',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};let payload;
 try{const box=publicationControls({client:{rpc:async(name,args)=>{if(name==='caro_publish_premium'){payload=args;return {data:{slug:'example-trial',version:1}};}return {data:{configuration:{title:'Example',timezone:'America/Vancouver',events:[]},content:{},reviewToken:'token'}};}},trial:{id:'trial',title:'Example'},action:work=>work(),message:()=>{},isCurrent:()=>true,isDirty:()=>false});const nodes=all(box);await nodes.find(n=>n.textContent==='Review public premium').listeners.click();nodes.find(n=>n.tag==='input'&&n.type==='checkbox').checked=true;await nodes.find(n=>n.textContent==='Publish reviewed premium').listeners.click();assert.equal(payload.p_online,true);assert.equal(payload.p_reviewed,true);assert.equal(payload.p_review_token,'token');}finally{globalThis.document=original;}
});
