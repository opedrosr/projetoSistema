import { supabase } from '@/lib/supabase';
import type {
  Appointment,
  BlockedTime,
  BusinessHour,
  Profile,
  Service,
} from '@/types';

export async function getPublicProfile(slug: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const [services, hours, blocks, availability] = await Promise.all([
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
      .from('blocked_times')
      .select('*')
      .eq('profile_id', data.id)
      .gte('ends_at', new Date().toISOString()),

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
  if (blocks.error) throw blocks.error;
  if (availability.error) throw availability.error;

  return {
    profile: data as Profile,
    services: services.data as Service[],
    hours: hours.data as BusinessHour[],
    blocks: blocks.data as BlockedTime[],
    availability: availability.data as Array<{
      id: string;
      profile_id: string;
      day_of_week: number;
      start_time: string;
      active: boolean;
    }>,
  };
}

export async function getAvailableSlots(
  profileId: string,
  date: string,
  serviceDuration: number,
  hours: BusinessHour[],
  blocks: BlockedTime[],
  availability: Array<{
    id: string;
    profile_id: string;
    day_of_week: number;
    start_time: string;
    active: boolean;
  }> = [],
) {
  const weekday = new Date(`${date}T12:00:00`).getDay();

  const day = hours.find(
    (item) => item.day_of_week === weekday,
  );

  if (
    !day?.is_open ||
    !day.start_time ||
    !day.end_time
  ) {
    return [];
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('starts_at, ends_at')
    .eq('profile_id', profileId)
    .eq('status', 'confirmed')
    .gte('starts_at', `${date}T00:00:00`)
    .lt('starts_at', `${date}T23:59:59`);

  if (error) throw error;

  const start = new Date(`${date}T${day.start_time}`);
  const end = new Date(`${date}T${day.end_time}`);
  const now = new Date();

  const configuredSlots = availability
    .filter(
      (slot) =>
        slot.profile_id === profileId &&
        slot.day_of_week === weekday &&
        slot.active,
    )
    .map((slot) => new Date(`${date}T${slot.start_time}`))
    .filter((slot) => {
      const slotEnd = new Date(
        slot.getTime() + serviceDuration * 60000,
      );
      return (
        slot >= start &&
        slotEnd <= end
      );
    });

  const slots: string[] = [];

  for (const cursor of configuredSlots) {
    const slotEnd = new Date(
      cursor.getTime() + serviceDuration * 60000,
    );

    const blockConflicts = blocks.filter(
      (block) =>
        new Date(block.starts_at) < slotEnd &&
        new Date(block.ends_at) > cursor,
    );

    const appointmentConflicts = (data ?? []).some(
      (item) =>
        new Date(item.starts_at) < slotEnd &&
        new Date(item.ends_at) > cursor,
    );

    if (
      cursor > now &&
      !appointmentConflicts &&
      blockConflicts.length === 0
    ) {
      slots.push(cursor.toTimeString().slice(0, 5));
    }
  }

  return slots;
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
