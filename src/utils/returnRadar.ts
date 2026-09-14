import type { Appointment, Service } from '@/types';

export type ReturnRadarStatus = 'overdue' | 'upcoming' | 'no_next';

export type ReturnRadarItem = {
  customerName: string;
  customerWhatsapp: string;
  serviceName: string;
  lastAppointmentAt: string;
  expectedReturnAt: string;
  habitualDays: number;
  daysOverdue: number;
  daysUntilReturn: number;
  status: ReturnRadarStatus;
  hasIndividualHistory: boolean;
};

export type ReturnRadarResult = {
  overdue: ReturnRadarItem[];
  upcoming: ReturnRadarItem[];
  noNext: ReturnRadarItem[];
  all: ReturnRadarItem[];
};

type RadarAppointment = Appointment & {
  service?: Pick<Service, 'name'> | null;
};

const FALLBACK_RETURN_DAYS: Array<{ keywords: string[]; days: number }> = [
  { keywords: ['lash', 'cílios', 'cilios'], days: 18 },
  { keywords: ['manutenção', 'manutencao', 'alongamento', 'nail', 'unha', 'unhas', 'gel'], days: 21 },
  { keywords: ['manicure'], days: 14 },
  { keywords: ['sobrancelha', 'sobrancelhas', 'brow', 'brows'], days: 21 },
  { keywords: ['cabelo', 'corte', 'escova', 'coloração', 'coloracao'], days: 30 },
  { keywords: ['estética', 'estetica', 'facial', 'limpeza de pele'], days: 30 },
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getFallbackDays(serviceName: string) {
  const normalized = normalizeText(serviceName);
  const match = FALLBACK_RETURN_DAYS.find((rule) =>
    rule.keywords.some((keyword) => normalized.includes(normalizeText(keyword))),
  );

  return match?.days ?? 21;
}

function brazilDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function parseBrazilDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateKey: string, days: number) {
  const date = parseBrazilDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function diffDays(fromDateKey: string, toDateKey: string) {
  const from = parseBrazilDateKey(fromDateKey).getTime();
  const to = parseBrazilDateKey(toDateKey).getTime();
  return Math.round((to - from) / 86400000);
}

function normalizePhone(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function customerKey(appointment: RadarAppointment) {
  const phone = normalizePhone(appointment.customer_whatsapp);
  if (phone) return `phone:${phone}`;
  return `name:${normalizeText(appointment.customer_name || '')}`;
}

export function buildReturnRadar(
  appointments: RadarAppointment[],
  services: Service[],
  referenceDate: Date = new Date(),
): ReturnRadarResult {
  const today = brazilDateKey(referenceDate);
  const confirmed = appointments.filter(
    (appointment) => appointment.status === 'confirmed' && Boolean(appointment.starts_at),
  );

  const grouped = new Map<string, RadarAppointment[]>();

  for (const appointment of confirmed) {
    const key = customerKey(appointment);
    const current = grouped.get(key) ?? [];
    current.push(appointment);
    grouped.set(key, current);
  }

  const result: ReturnRadarResult = {
    overdue: [],
    upcoming: [],
    noNext: [],
    all: [],
  };

  for (const customerAppointments of grouped.values()) {
    const pastAppointments = customerAppointments
      .filter((appointment) => new Date(appointment.starts_at).getTime() <= referenceDate.getTime())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    if (!pastAppointments.length) continue;

    const futureAppointments = customerAppointments
      .filter((appointment) => new Date(appointment.starts_at).getTime() > referenceDate.getTime())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const lastAppointment = pastAppointments[pastAppointments.length - 1];
    const lastDateKey = brazilDateKey(lastAppointment.starts_at);
    const serviceName = lastAppointment.service?.name ||
      services.find((service) => service.id === lastAppointment.service_id)?.name ||
      'Serviço';

    let habitualDays = getFallbackDays(serviceName);
    let hasIndividualHistory = false;

    if (pastAppointments.length >= 2) {
      const intervals: number[] = [];
      for (let index = 1; index < pastAppointments.length; index += 1) {
        const previous = brazilDateKey(pastAppointments[index - 1].starts_at);
        const current = brazilDateKey(pastAppointments[index].starts_at);
        const interval = diffDays(previous, current);
        if (interval >= 7 && interval <= 120) intervals.push(interval);
      }

      if (intervals.length) {
        hasIndividualHistory = true;
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
        habitualDays = Math.round((average * 0.5) + (median * 0.5));
      }
    }

    const expectedReturnAt = addDays(lastDateKey, habitualDays);
    const daysUntilReturn = diffDays(today, expectedReturnAt);
    const daysOverdue = Math.max(0, -daysUntilReturn);
    const hasNextAppointment = futureAppointments.length > 0;

    if (hasNextAppointment) continue;

    let status: ReturnRadarStatus;
    if (daysUntilReturn < 0) {
      status = 'overdue';
    } else if (daysUntilReturn <= 5) {
      status = 'upcoming';
    } else {
      status = 'no_next';
    }

    const item: ReturnRadarItem = {
      customerName: lastAppointment.customer_name || 'Cliente',
      customerWhatsapp: lastAppointment.customer_whatsapp || '',
      serviceName,
      lastAppointmentAt: lastAppointment.starts_at,
      expectedReturnAt,
      habitualDays,
      daysOverdue,
      daysUntilReturn,
      status,
      hasIndividualHistory,
    };

    result.all.push(item);
    if (status === 'overdue') result.overdue.push(item);
    if (status === 'upcoming') result.upcoming.push(item);
    if (status === 'no_next') result.noNext.push(item);
  }

  const sortByPriority = (a: ReturnRadarItem, b: ReturnRadarItem) => {
    if (a.status === 'overdue' && b.status === 'overdue') return b.daysOverdue - a.daysOverdue;
    if (a.status === 'upcoming' && b.status === 'upcoming') return a.daysUntilReturn - b.daysUntilReturn;
    return new Date(a.expectedReturnAt).getTime() - new Date(b.expectedReturnAt).getTime();
  };

  result.overdue.sort(sortByPriority);
  result.upcoming.sort(sortByPriority);
  result.noNext.sort(sortByPriority);
  result.all.sort((a, b) => {
    const rank = { overdue: 0, upcoming: 1, no_next: 2 };
    return rank[a.status] - rank[b.status] || sortByPriority(a, b);
  });

  return result;
}

export function generateReturnMessage(item: ReturnRadarItem) {
  const name = item.customerName.split(' ')[0] || item.customerName;

  if (item.status === 'overdue') {
    return `Oii, ${name}! Tudo bem? Já passou um pouquinho do período que você costuma fazer sua manutenção. Se quiser, posso te passar os horários disponíveis dessa semana. 💕`;
  }

  if (item.status === 'upcoming') {
    return `Oii, ${name}! Tudo bem? Seu próximo período de atendimento está chegando e já estou organizando os horários dos próximos dias. Se quiser, posso te passar os horários disponíveis. 💕`;
  }

  return `Oii, ${name}! Tudo bem? Estava organizando minha agenda e lembrei do seu último atendimento de ${item.serviceName}. Se quiser fazer sua próxima manutenção, posso te passar os horários disponíveis. 💕`;
}
