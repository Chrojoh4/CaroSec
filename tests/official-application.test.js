import test from 'node:test';
import assert from 'node:assert/strict';
import {officialApplicationPacket,officialEventText} from '../src/domain/official-application.js';
import {fillOfficialFields} from '../hosted/caro-helper/fill.js';
import {applicationHelperArchive} from '../scripts/application-helper-archive.js';

const trial=()=>({title:'Example trial',is_practice:false,start_date:'2027-04-17',end_date:'2027-04-18',revision:2,planning:{organizerEmail:'organizer@example.com',host:'Example host',chair:'Chair',chairEmail:'chair@example.com',secretary:'Secretary',email:'secretary@example.com',venue:'Venue',address:'Street address',memberReference:'PRIVATE-MEMBER-REFERENCE',events:[{id:'event-1',dayId:'2027-04-17',format:'Regular',level:'Novice',stream:'B',judge:'Judge A'},{id:'event-2',dayId:'2027-04-18',format:'Working',level:'Working',stream:'Rookie',judge:'Judge B',exercises:'Drop on Recall'}]}});
function page(t,nodes=[]){
 class Input{constructor(id='',value='',model=null){this.id=id;this._value=value;this.model=model;this.tagName='INPUT';this.type='text';this.disabled=false;this.readOnly=false;this.checked=false;this.events=[];this.visible=true;}get value(){return this._value;}set value(v){this._value=v;}getClientRects(){return this.visible?[{}]:[];}getAttribute(name){return name==='wire:model.defer'?this.model:null;}dispatchEvent(event){this.events.push(event.type);}}
 Object.defineProperty(Input.prototype,'checked',{get(){return this._checked;},set(v){this._checked=v;},configurable:true});
 class Select extends Input{constructor(model,options){super('','',model);this.tagName='SELECT';this.options=options;}get value(){return this._value;}set value(v){this._value=v;}}
 const originals=new Map();for(const [key,value] of Object.entries({location:{origin:'https://app.canadianrallyo.ca',pathname:'/trialapplication'},document:{querySelectorAll:()=>nodes},getComputedStyle:()=>({visibility:'visible'}),HTMLInputElement:Input,HTMLSelectElement:Select,HTMLTextAreaElement:Input})){originals.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 t.after(()=>{for(const [key,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];});return {Input,Select,nodes};
}
test('official transfer preserves round order and only includes application contact fields',()=>{
 const value=trial();value.password='PRIVATE-PASSWORD';value.planning.audit=[{token:'PRIVATE-TOKEN'}];const packet=officialApplicationPacket(value),text=JSON.stringify(packet);
 assert.equal(packet.fields.professionalMemberEmail,'organizer@example.com');assert.equal(packet.fields['trialTypes.working'],true);assert.equal(packet.events[1].round,2);assert.match(officialEventText(packet),/Round 2.*2027-04-18/);
 for(const secret of ['PRIVATE-MEMBER-REFERENCE','PRIVATE-PASSWORD','PRIVATE-TOKEN'])assert.equal(text.includes(secret),false);
 value.title='Practice TEST ONLY';assert.equal(officialApplicationPacket(value).trial.practice,true);
});
test('official helper fills verified first-page controls, preserves existing values and dispatches only input/change',t=>{
 const {Input,nodes}=page(t);const host=new Input('host_name'),chair=new Input('chairperson','Existing chair'),email=new Input('professional_member_email');nodes.push(host,chair,email);
 const result=fillOfficialFields(officialApplicationPacket(trial()));assert.equal(host.value,'Example host');assert.equal(email.value,'organizer@example.com');assert.equal(chair.value,'Existing chair');assert.deepEqual(host.events,['input','change']);assert.ok(result.some(r=>r.field==='host.chairperson'&&r.status==='existing value - unchanged'));
 fillOfficialFields(officialApplicationPacket(trial()),true);assert.equal(chair.value,'Chair');
});
test('helper skips hidden, ambiguous and unknown official options rather than guessing',t=>{
 const {Input,Select,nodes}=page(t);const hidden=new Input('host_name');hidden.visible=false;const duplicate1=new Input('secretary'),duplicate2=new Input('secretary'),province=new Select('trial.province',[{textContent:'British Columbia',value:'2'}]);nodes.push(hidden,duplicate1,duplicate2,province);
 const packet=officialApplicationPacket(trial());packet.fields['trial.province']='Alberta';const result=fillOfficialFields(packet);assert.equal(hidden.value,'');assert.equal(duplicate1.value,'');assert.equal(province.value,'');assert.ok(result.some(r=>r.status==='ambiguous - unchanged'));assert.ok(result.some(r=>r.status==='choose the official option manually'));
 packet.fields['trial.province']='British Columbia';fillOfficialFields(packet);assert.equal(province.value,'2');
});
test('helper refuses other websites, practice packets and non-application controls',t=>{
 const {Input,nodes}=page(t);const input=new Input('password');nodes.push(input);const packet=officialApplicationPacket(trial());packet.fields.password='must-not-fill';fillOfficialFields(packet);assert.equal(input.value,'');
 packet.trial.practice=true;assert.throws(()=>fillOfficialFields(packet),/Practice packets/);packet.trial.practice=false;location.origin='https://example.com';assert.throws(()=>fillOfficialFields(packet),/official CARO/);
});
test('helper function is self-contained when serialized for the isolated extension context',t=>{
 const {Input,nodes}=page(t);const host=new Input('host_name');nodes.push(host);const serialized=(0,eval)('('+fillOfficialFields.toString()+')');serialized(officialApplicationPacket(trial()));assert.equal(host.value,'Example host');
});
test('browser-helper ZIP contains the fixed source allowlist and no host-wide permissions',async()=>{
 const bytes=await applicationHelperArchive();assert.equal(bytes.readUInt32LE(0),0x04034b50);const source=bytes.toString('utf8');assert.ok(source.includes('manifest.json'));assert.ok(source.includes('popup.js'));assert.equal(source.includes('sb_publishable_'),false);assert.equal(source.includes('host_permissions'),false);assert.equal(source.includes('http://localhost'),false);
});
