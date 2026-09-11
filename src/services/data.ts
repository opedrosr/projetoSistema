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

  const [services, hours, blocks] = await Promise.all([
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
  ]);

  if (services.error) throw services.error;
  if (hours.error) throw hours.error;
  if (blocks.error) throw blocks.error;

  return {
    profile: data as Profile,
    services: services.data as Service[],
    hours: hours.data as BusinessHour[],
    blocks: blocks.data as BlockedTime[],
  };
}

export async function getAvailableSlots(
  profileId: string,
  date: string,
  serviceDuration: number,
  hours: BusinessHour[],
  blocks: BlockedTime[],
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

  const slots: string[] = [];

  // Cada serviço define o intervalo entre os horários disponíveis.
  // Ex.: serviço de 30 min -> 08:00, 08:30, 09:00...
  // Serviço de 60 min -> 08:00, 09:00, 10:00...
  // Serviço de 90 min -> 08:00, 09:30, 11:00...
  for (
    let cursor = new Date(start);
    cursor.getTime() + serviceDuration * 60000 <=
      end.getTime();
    cursor = new Date(
      cursor.getTime() + serviceDuration * 60000,
    )
  ) {
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

    const conflicts =
      appointmentConflicts ||
      blockConflicts.length > 0;

    if (cursor > now && !conflicts) {
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
  // O calendário envia o horário local do Brasil sem fuso (ex.: 2026-09-11T14:30:00).
  // Como o banco usa timestamptz, precisamos informar explicitamente o fuso
  // para evitar que o Supabase interprete o horário como UTC e desloque
  // o dia/horário exibido nos agendamentos.
  const normalizedStartsAt =
    /[zZ]|[+-]\\d{2}:\\d{2}$/.test(startsAt)
      ? startsAt
      : `${startsAt}-03:00`;

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
  ]);

  const result = [
    services,
    hours,
    blocks,
    appointments,
  ].find((item) => item.error);

  if (result?.error) {
    throw result.error;
  }

  return {
    profile: profile.data as Profile,
    services: services.data as Service[],
    hours: hours.data as BusinessHour[],
    blocks: blocks.data as BlockedTime[],
    appointments:
      appointments.data as Appointment[],
  };
}