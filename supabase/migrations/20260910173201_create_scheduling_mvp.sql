/*
# Create scheduling MVP foundation

1. New tables
- `profiles`: one public business profile per authenticated professional, including the public slug and contact details.
- `services`: active/inactive services owned by a professional, with price and duration.
- `business_hours`: weekly opening windows owned by a professional.
- `blocked_times`: date/time blocks owned by a professional.
- `appointments`: confirmed or cancelled bookings with customer details and service snapshots.

2. Security
- RLS is enabled on every table.
- Authenticated professionals can only manage their own records.
- Public visitors can read only the fields needed to render a booking page and can create appointments through a validated RPC.
- The appointment RPC resolves the real service price and duration server-side.

3. Integrity
- Public slugs are unique.
- Appointment time ranges use an exclusion constraint to reject overlapping confirmed appointments for the same professional.
- Cancelled appointments do not block time.

4. Important notes
- Payment tables and payment flows are not created or used.
- The public booking flow does not require customer authentication.
*/

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  specialty text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  avatar_url text,
  whatsapp text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 720),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_open boolean NOT NULL DEFAULT false,
  start_time time,
  end_time time,
  UNIQUE (profile_id, day_of_week),
  CHECK ((is_open = false) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time))
);

CREATE TABLE IF NOT EXISTS public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  customer_whatsapp text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS services_profile_id_idx ON public.services(profile_id);
CREATE INDEX IF NOT EXISTS blocked_times_profile_range_idx ON public.blocked_times(profile_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS appointments_profile_start_idx ON public.appointments(profile_id, starts_at);

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (profile_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'confirmed');

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_profiles" ON public.profiles;
CREATE POLICY "public_read_profiles" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_profiles" ON public.profiles;
CREATE POLICY "owner_insert_profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owner_update_profiles" ON public.profiles;
CREATE POLICY "owner_update_profiles" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "owner_delete_profiles" ON public.profiles;
CREATE POLICY "owner_delete_profiles" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "public_read_active_services" ON public.services;
CREATE POLICY "public_read_active_services" ON public.services FOR SELECT TO anon, authenticated USING (is_active = true);
DROP POLICY IF EXISTS "owner_read_services" ON public.services;
CREATE POLICY "owner_read_services" ON public.services FOR SELECT TO authenticated USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_insert_services" ON public.services;
CREATE POLICY "owner_insert_services" ON public.services FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_update_services" ON public.services;
CREATE POLICY "owner_update_services" ON public.services FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_delete_services" ON public.services;
CREATE POLICY "owner_delete_services" ON public.services FOR DELETE TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "public_read_hours" ON public.business_hours;
CREATE POLICY "public_read_hours" ON public.business_hours FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_hours" ON public.business_hours;
CREATE POLICY "owner_insert_hours" ON public.business_hours FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_update_hours" ON public.business_hours;
CREATE POLICY "owner_update_hours" ON public.business_hours FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_delete_hours" ON public.business_hours;
CREATE POLICY "owner_delete_hours" ON public.business_hours FOR DELETE TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "public_read_blocks" ON public.blocked_times;
CREATE POLICY "public_read_blocks" ON public.blocked_times FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_insert_blocks" ON public.blocked_times;
CREATE POLICY "owner_insert_blocks" ON public.blocked_times FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_update_blocks" ON public.blocked_times;
CREATE POLICY "owner_update_blocks" ON public.blocked_times FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_delete_blocks" ON public.blocked_times;
CREATE POLICY "owner_delete_blocks" ON public.blocked_times FOR DELETE TO authenticated USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "owner_read_appointments" ON public.appointments;
CREATE POLICY "owner_read_appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.uid() = profile_id);
DROP POLICY IF EXISTS "owner_update_appointments" ON public.appointments;
CREATE POLICY "owner_update_appointments" ON public.appointments FOR UPDATE TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_profile_id uuid,
  p_service_id uuid,
  p_customer_name text,
  p_customer_whatsapp text,
  p_starts_at timestamptz
) RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_row public.services;
  result_row public.appointments;
BEGIN
  IF length(trim(p_customer_name)) < 2 OR length(trim(p_customer_whatsapp)) < 8 THEN
    RAISE EXCEPTION 'invalid_customer';
  END IF;

  SELECT * INTO service_row FROM public.services
  WHERE id = p_service_id AND profile_id = p_profile_id AND is_active = true;

  IF service_row.id IS NULL THEN
    RAISE EXCEPTION 'service_unavailable';
  END IF;

  INSERT INTO public.appointments (
    profile_id, service_id, customer_name, customer_whatsapp, starts_at, ends_at, price, duration_minutes
  ) VALUES (
    p_profile_id, p_service_id, trim(p_customer_name), trim(p_customer_whatsapp), p_starts_at,
    p_starts_at + make_interval(mins => service_row.duration_minutes), service_row.price, service_row.duration_minutes
  ) RETURNING * INTO result_row;

  RETURN result_row;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION 'slot_taken';
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment(uuid, uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(uuid, uuid, text, text, timestamptz) TO anon, authenticated;
