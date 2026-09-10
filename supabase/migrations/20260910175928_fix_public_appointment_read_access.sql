/*
# Fix public read access to appointment time slots

1. Problem
- The public booking page queries `appointments` to calculate available time slots.
- RLS is enabled but there is no SELECT policy for the `anon` role on `appointments`.
- Result: the anon-key frontend gets zero rows, so slot calculation ignores existing bookings.
- The database exclusion constraint still prevents double-booking at insert time, but the UX is broken — clients see slots that are actually taken.

2. Fix
- REVOKE the broad table-level SELECT from `anon` on `appointments`.
- GRANT column-level SELECT on only `profile_id`, `starts_at`, `ends_at`, `status` to `anon`.
- Add a SELECT policy for `anon` and `authenticated` that only returns `status = 'confirmed'` rows.
- This way the public page can read time slots for conflict checking, but can NEVER see customer names or WhatsApp numbers.

3. Security
- `anon` can only read: profile_id, starts_at, ends_at, status (column-level privilege).
- `anon` can only read rows where status = 'confirmed' (RLS policy).
- Customer PII (customer_name, customer_whatsapp) is never exposed to the public.
- The `create_public_appointment` SECURITY DEFINER function remains the only way for anon to create appointments.
*/

REVOKE SELECT ON public.appointments FROM anon;

GRANT SELECT (profile_id, starts_at, ends_at, status) ON public.appointments TO anon;

DROP POLICY IF EXISTS "public_read_appointment_slots" ON public.appointments;
CREATE POLICY "public_read_appointment_slots" ON public.appointments
  FOR SELECT TO anon, authenticated
  USING (status = 'confirmed');
