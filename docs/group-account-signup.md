# Club meeting account signup

Each attendee creates their own staff account on https://carosec.vercel.app/. Confirmation links may open in a different tab in the same browser/profile/device. Login tokens remain tab-local. Signup grants no club membership, trial assignment or administrator privileges. A club administrator assigns access after signup.

## Supabase setup before a meeting
Authentication → URL Configuration: keep Site URL https://carosec.vercel.app/ and existing redirect URLs. Add these exact patterns (the asterisk is intentional):

```
https://carosec.vercel.app/?sb_flow_id=*
https://carosec.vercel.app/?auth=recovery&sb_flow_id=*
```

The SDK adds a random per-request flow ID to its email return URLs. These narrow same-origin patterns allow that identifier without granting redirects to other domains. Retain the existing root and recovery redirect entries for earlier links. If email templates were customized, preserve the complete ConfirmationURL or RedirectTo, including its query parameters.

Configure custom SMTP for real attendees. Supabase’s default sender only delivers to project team addresses and is heavily limited. Review Supabase Auth email rate limits and the sender provider’s quota for the expected group, including reminder/reset emails. Attendees sharing venue Wi-Fi may share an IP address; review applicable Auth limits rather than disabling protections. Test one new non-team account and a password reset before the meeting. No live group load test or SMTP configuration has been performed by the agent.

## Verification
Tests use the pinned official Supabase SDK with mocked Auth transport to start two signup requests concurrently, capture distinct flow IDs, then confirm them in reverse order from separate new tabs. Each exchange’s verifier hash must match its original challenge; each callback tab receives only its own user session, and requesting tabs receive no session. Tests also cover invalid inputs, generic errors and clear sender-rate-limit feedback. The experimental appendPkceFlowIdToRedirects SDK option is explicit and must be rechecked on SDK upgrades.

Primary sources: https://supabase.com/docs/guides/auth/sessions/pkce-flow and https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/auth/rate-limits
