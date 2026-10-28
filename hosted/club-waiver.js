// Reuse only waivers the signed-in staff member is already allowed to read.
export async function loadClubWaiver(client,trial,content={}){
 if(typeof content.waiver==='string'&&content.waiver.trim())return {};
 const {data,error}=await client.from('caro_premium_drafts').select('trial_id,content,caro_trials!inner(title,is_practice)').eq('club_id',trial.club_id).neq('trial_id',trial.id).eq('caro_trials.is_practice',trial.is_practice===true).not('content->>waiver','is',null).neq('content->>waiver','').order('updated_at',{ascending:false}).limit(20);
 if(error)return {error:true};
 const previous=(data||[]).find(row=>typeof row.content?.waiver==='string'&&row.content.waiver.trim()&&!/DRAFT\s+PLACEHOLDER/i.test(row.content.waiver));
 return previous?{text:previous.content.waiver,title:previous.caro_trials?.title||''}:{};
}
export function applyClubWaiver(content,previous){
 const copy=structuredClone(content);
 if((typeof copy.waiver==='string'&&copy.waiver.trim())||!previous?.text)return {content:copy,filled:false};
 copy.waiver=previous.text;return {content:copy,filled:true};
}
