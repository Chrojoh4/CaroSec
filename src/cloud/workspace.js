export async function loadWorkspace(client){
  const [clubs,trials]=await Promise.all([
    client.from('caro_clubs').select('id,name,timezone').order('name'),
    client.from('caro_trials').select('id,club_id,title,start_date,end_date,timezone,application_state').order('start_date'),
  ]);
  if(clubs.error||trials.error)throw new Error('The workspace could not be loaded. Check the database setup and your access.');
  return {clubs:clubs.data||[],trials:trials.data||[]};
}
export async function createClub(client,name,timezone){
  const trimmed=String(name||'').trim();
  if(!trimmed||trimmed.length>150)throw new Error('Enter a club name of 1 to 150 characters.');
  try{new Intl.DateTimeFormat('en-CA',{timeZone:timezone}).format();}catch{throw new Error('Choose a valid club timezone.');}
  if(!timezone)throw new Error('Choose a club timezone.');
  const {data,error}=await client.rpc('caro_create_club',{p_name:trimmed,p_timezone:timezone});
  if(error)throw new Error('Club creation failed. Refresh your workspace before trying again; the request may have completed.');
  return data;
}
