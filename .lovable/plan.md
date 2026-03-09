

## Plan: Reset password for bigschool@test.docencia.ai

### What
Change the password of `bigschool@test.docencia.ai` from the current `bigshool` to `bigschool`.

### How
Create a small temporary edge function (or use an existing one) to call the Supabase Auth Admin API `updateUserById` with the new password. Alternatively, since this is a one-time admin operation:

1. **Create a short-lived edge function** `reset-test-password/index.ts` that uses the service role key to update the user's password via `supabase.auth.admin.updateUserById(userId, { password: 'bigschool' })`.
2. **Call it once** to apply the change.
3. **Delete the edge function** after use.

This is the simplest path since we cannot modify auth tables directly via SQL.

