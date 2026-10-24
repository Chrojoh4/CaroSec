export function validateNewPassword(password,confirmation){
 if(typeof password!=='string'||password.length<8||password.length>128)throw new Error('Use a password between 8 and 128 characters.');
 if(password!==confirmation)throw new Error('The two passwords do not match.');
}
export async function requestPasswordReset(auth,email,origin){
 const address=String(email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)throw new Error('Enter a valid email address.');
 const url=new URL('/',origin);if(!['https:','http:'].includes(url.protocol))throw new Error('Invalid recovery address.');url.searchParams.set('auth','recovery');
 const {error}=await auth.resetPasswordForEmail(address,{redirectTo:url.href});
 if(error)throw new Error('The reset email could not be requested. Wait a minute and try again, or contact the administrator.');
 return 'If an account exists for that address, a password-reset email will be sent. Check your spam folder too. Open the newest reset link in this browser. It can open in a new tab.';
}
export async function exchangeEmailCallback(auth,code,flowId=null){
 if(flowId!==null&&!/^[A-Za-z0-9_-]{8,64}$/.test(flowId))throw new Error('This email link is invalid. Request a new link.');
 const {data,error}=await auth.exchangeCodeForSession(code,flowId?{flowId}:undefined);
 if(error||!data?.session||!data?.user||data.user.is_anonymous)throw new Error('This email link has expired, was already used, or was opened in a different browser. Request a new link, then open the newest email in the browser where you requested it.');
 return data.redirectType==='recovery';
}
export async function saveRecoveredPassword(auth,password,confirmation,ready){
 if(!ready)throw new Error('Open a valid password-reset email first.');validateNewPassword(password,confirmation);
 const verified=await auth.getUser();if(verified.error||!verified.data?.user||verified.data.user.is_anonymous)throw new Error('The reset session has expired. Request another password-reset email.');
 const {error}=await auth.updateUser({password});
 if(error)throw new Error('The password could not be changed. It may not meet the account’s password requirements, or the reset session may have expired.');
 const result=await auth.signOut({scope:'global'});
 return result.error?'Password changed. Other sessions could not be signed out; sign out here and sign in again with your new password.':'Password changed. Sign in with your new password.';
}
