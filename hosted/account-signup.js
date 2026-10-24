export async function createStaffAccount(auth,email,password,origin){
 const address=String(email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)throw new Error('Enter a valid email address.');
 if(typeof password!=='string'||password.length<8||password.length>128)throw new Error('Use a password between 8 and 128 characters.');
 const {data,error}=await auth.signUp({email:address,password,options:{emailRedirectTo:new URL('/',origin).href}});
 if(error){
  if(error.status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(error.code))throw new Error('Account emails are temporarily rate limited. Wait before trying again. For a group session, ask the administrator to check the email sender and Auth rate limits.');
  throw new Error('Account creation could not be completed. Check the password requirements or contact the trial administrator.');
 }
 return {signedIn:!!data?.session,message:'Check your email to confirm your account. Open the link in this browser; a new tab is fine. Your club administrator can then grant club and trial access.'};
}
