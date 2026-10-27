import test from 'node:test';import assert from 'node:assert/strict';import {publicationControls} from '../hosted/publication.js';
class Node{constructor(tag){this.tag=tag;this.children=[];this.listeners={};this.disabled=false;this.checked=false;}append(...nodes){this.children.push(...nodes);}prepend(...nodes){this.children.unshift(...nodes);}addEventListener(name,callback){this.listeners[name]=callback;}}
const all=n=>[n,...n.children.flatMap(all)];
test('successful publication review enables Publish after the shared busy guard restores button states',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};let box,dirty=false,calls=0;
 try{
  const client={rpc:async()=>{calls++;return {data:{configuration:{title:'Example',timezone:'America/Vancouver',events:[]},content:{},judgeAmendments:[],reviewToken:'review'}};}};
  const action=async work=>{const saved=all(box).filter(n=>n.tag==='button').map(button=>({button,disabled:button.disabled}));for(const {button} of saved)button.disabled=true;try{await work();}catch{}finally{for(const {button,disabled} of saved)button.disabled=disabled;}};
  box=publicationControls({client,trial:{id:'trial',title:'Example'},action,message:()=>{},isCurrent:()=>true,isDirty:()=>dirty});
  const nodes=all(box),review=nodes.find(n=>n.textContent==='Review public premium'),publish=nodes.find(n=>n.textContent==='Publish reviewed premium');
  assert.equal(publish.disabled,true);await review.listeners.click();assert.equal(publish.disabled,false);assert.equal(calls,1);
  dirty=true;await review.listeners.click();assert.equal(publish.disabled,true);assert.equal(calls,1);
 }finally{globalThis.document=original;}
});
test('an outdated publication screen cannot enable Publish',async()=>{
 const original=globalThis.document;globalThis.document={createElement:tag=>new Node(tag)};
 try{const box=publicationControls({client:{rpc:async()=>({data:{}})},trial:{id:'trial',title:'Example'},action:async work=>work(),message:()=>{},isCurrent:()=>false,isDirty:()=>false});const nodes=all(box);await nodes.find(n=>n.textContent==='Review public premium').listeners.click();assert.equal(nodes.find(n=>n.textContent==='Publish reviewed premium').disabled,true);}finally{globalThis.document=original;}
});
