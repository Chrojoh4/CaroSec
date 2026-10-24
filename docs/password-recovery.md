# Staff password recovery

The sign-in screen provides Forgot password, an email-only request form, and a verified-link password selection screen. Requests return generic account-independent text. New passwords must match and be 8–128 characters; Supabase enforces its configured password policy as well. The Auth server verifies the user before updating a password, and successful updates request global session sign-out. No service key or database migration is needed.

## Required hosted configuration
In CARO Supabase Authentication → URL Configuration, confirm the Site URL is https://carosec.vercel.app/ and add https://carosec.vercel.app/?auth=recovery to Redirect URLs. Preserve existing authorized production URLs. Configure a production SMTP sender and test delivery. Security email notifications (password/email changed and relevant identity/MFA changes) are separate dashboard settings; this code does not change them.

The browser uses PKCE with sessionStorage. Keep the requesting tab open and open the emailed reset link in that same tab, so its verifier remains available. Links opened without that verifier, reused/expired links and malformed callbacks show a recovery error. Only a successful exchange classified as recovery opens the password form; a query parameter alone does not. Callback codes/errors are removed from the address bar, and password inputs are cleared after save attempts and cancellation.

## Validation
135 automated tests passed with the recovery implementation. Dedicated tests cover generic email requests, redirect destination, invalid inputs, recovery versus ordinary confirmation, expired links, anonymous users, current-user verification, password mismatch, server rejection and session sign-out. The actual hosted screens were tested in a localhost build with fictional Auth responses: request confirmation, verified recovery form and invalid-link handling. No real reset email or password change was performed. Live delivery and real email-link acceptance remain to be tested after dashboard URL and SMTP configuration.
