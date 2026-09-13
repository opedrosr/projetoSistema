import { supabase } from '@/lib/supabase';
import type {
  Appointment,
  BlockedTime,
  BusinessHour,
  Profile,
  Service,
} from '@/types';

export async function getPublicProfile(slug: string) {
  const { data: profileData, error: profileError } = await supabase.rpc(
    'get_public_profile',
    {
      p_slug: slug.trim(),
    },
  );

  if (profileError) throw profileError;

  const data = Array.isArray(profileData) ? profileData[0] : profileData;

  if (!data) return null;

  const [services, hours, availability] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .eq('profile_id', data.id)
      .eq('is_active', true)
      .order('created_at'),

    supabase
      .from('business_hours')
      .select('*')
      .eq('profile_id', data.id)
      .order('day_of_week'),

    supabase
      .from('availability_slots')
      .select('*')
      .eq('profile_id', data.id)
      .eq('active', true)
      .order('day_of_week')
      .order('start_time'),
  ]);

  if (services.error) throw services.error;
  if (hours.error) throw hours.error;
  if (availability.error) throw availability.error;

  return {
    profile: data as Profile,
    services: services.data as Service[],
    hours: hours.data as BusinessHour[],
    // Bloqueios são privados. A disponibilidade pública é calculada pelo RPC.
    blocks: [] as BlockedTime[],
    availability: availability.data as Array<{
      id: string;
      profile_id: string;
      day_of_week: number;
      start_time: string;
      active: boolean;
    }>,
  };
}

export async function getPublicPixKey(profileId: string) {
  const { data, error } = await supabase.rpc('get_public_pix_key', {
    p_profile_id: profileId,
  });

  if (error) throw error;

  return typeof data === 'string' ? data : '';
}

export async function getAvailableSlots(
  profileId: string,
  date: string,
  serviceDuration: number,
  _hours: BusinessHour[],
  _blocks: BlockedTime[],
  _availability: Array<{
    id: string;
    profile_id: string;
    day_of_week: number;
    start_time: string;
    active: boolean;
  }> = [],
) {
  const { data, error } = await supabase.rpc(
    'get_public_available_slots',
    {
      p_profile_id: profileId,
      p_date: date,
      p_service_duration: serviceDuration,
    },
  );

  if (error) throw error;

  return (data ?? []).map((item: { slot_time?: string } | string) =>
    typeof item === 'string' ? item.slice(0, 5) : String(item.slot_time).slice(0, 5),
  );
}

export async function createAppointment(
  profileId: string,
  serviceId: string,
  customerName: string,
  customerWhatsapp: string,
  startsAt: string,
) {
  // Os horários escolhidos pelo cliente são horários locais de Brasília.
  // Convertemos explicitamente para ISO/UTC antes de enviar ao timestamptz,
  // evitando que o navegador/Postgres interprete o horário como UTC.
  const normalizedStartsAt = /[zZ]|[+-]\d{2}:\d{2}$/.test(startsAt)
    ? new Date(startsAt).toISOString()
    : new Date(`${startsAt}-03:00`).toISOString();

  console.log('CRIANDO AGENDAMENTO:', {
    profileId,
    serviceId,
    customerName,
    customerWhatsapp,
    startsAt,
    normalizedStartsAt,
  });

  const { data, error } = await supabase.rpc(
    'create_public_appointment',
    {
      p_profile_id: profileId,
      p_service_id: serviceId,
      p_customer_name: customerName,
      p_customer_whatsapp: customerWhatsapp,
      p_starts_at: normalizedStartsAt,
    },
  );

  console.log('RESPOSTA RPC AGENDAMENTO:', {
    data,
    error,
  });

  if (error) {
    console.error('ERRO RPC AGENDAMENTO:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    throw error;
  }

  if (!data) {
    throw new Error(
      'O Supabase não retornou o agendamento criado.',
    );
  }

  return data as Appointment;
}

export async function getOwnerData(userId: string) {
  console.log(
    'DASHBOARD 1 - buscando profile',
    userId,
  );

  const profile = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  console.log('DASHBOARD 2 - profile:', profile);

  if (profile.error) throw profile.error;

  if (!profile.data) {
    console.warn('DASHBOARD - PROFILE NÃO ENCONTRADO');
    return null;
  }

  const [
    services,
    hours,
    blocks,
    appointments,
    availability,
  ] = await Promise.all([
    supabase
      .from('services')
      .select('*')
      .eq('profile_id', userId)
      .order('created_at'),

    supabase
      .from('business_hours')
      .select('*')
      .eq('profile_id', userId)
      .order('day_of_week'),

    supabase
      .from('blocked_times')
      .select('*')
      .eq('profile_id', userId)
      .order('starts_at'),

    supabase
      .from('appointments')
      .select('*, service:services(name)')
      .eq('profile_id', userId)
      .order('starts_at'),

    supabase
      .from('availability_slots')
      .select('*')
      .eq('profile_id', userId)
      .order('day_of_week')
      .order('start_time'),
  ]);

  const result = [
    services,
    hours,
    blocks,
    appointments,
    availability,
  ].find((item) => item.error);

  if (result?.error) {
    throw result.error;
  }

  return {
    profile: profile.data as Profile,
    services: services.data as Service[],
    hours: hours.data as BusinessHour[],
    blocks: blocks.data as BlockedTime[],
    appointments: appointments.data as Appointment[],
    availability: availability.data as Array<{
      id: string;
      profile_id: string;
      day_of_week: number;
      start_time: string;
      active: boolean;
    }>,
  };
}
