export function showWorkspaceError(value){
 let dialog=document.getElementById('workspace-error-dialog');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='workspace-error-dialog';dialog.className='workspace-error-dialog';dialog.setAttribute('aria-labelledby','workspace-error-title');dialog.setAttribute('aria-describedby','workspace-error-text');
  const title=document.createElement('h2');title.id='workspace-error-title';title.textContent='Please check this';
  const text=document.createElement('p');text.id='workspace-error-text';text.setAttribute('role','alert');
  const close=document.createElement('button');close.type='button';close.textContent='Return to my work';close.autofocus=true;close.addEventListener('click',()=>dialog.close());
  dialog.append(title,text,close);document.body.append(dialog);
 }
 dialog.querySelector('#workspace-error-text').textContent=String(value);
 if(!dialog.open)dialog.showModal();
}
