

## Plan: Create QA Test User with Plan Switching

### What We Need

Create a test user `bigschool@test.docencia.ai` with password `bigshool` that can log in and switch between FREE, BASICO, and PREMIUM plans using the existing PlanSwitcher component.

### Steps

1. **Create the user in the database** using a one-time edge function (`create-qa-user`) that:
   - Uses the admin/service-role client to call `auth.admin.createUser` with email `bigschool@test.docencia.ai`, password `bigshool`, and `email_confirm: true` (so no verification email needed)
   - The existing `handle_new_user` trigger will automatically create the profile, role, subscription (FREE), entitlements, and usage counter

2. **Fix QA_EMAILS in two places** — the current entries have a typo (`bigscholl` with double L). Update to `bigschool@test.docencia.ai`:
   - `src/pages/Dashboard.tsx` line 72
   - `supabase/functions/set-test-plan/index.ts` line 10

3. **Invoke the edge function once** to create the user, then optionally delete the function since it's a one-time operation.

### Result

- Login at `/login` with email `bigschool@test.docencia.ai` and password `bigshool`
- Dashboard shows a plan dropdown (FREE / BASICO / PREMIUM) to switch roles instantly
- All app features accessible based on the selected plan level

### Notes
- The existing `handle_new_user` trigger handles all provisioning (profile, role, subscription, entitlements, usage counter)
- The existing `PlanSwitcher` + `set-test-plan` edge function already support plan switching for QA users

