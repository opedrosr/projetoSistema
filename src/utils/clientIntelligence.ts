import type { Appointment, Service } from '@/types';

type IntelligenceAppointment = Appointment & {
  service?: {
    name?: string | null;
  } | null;
};

export type CustomerProfile = {
  key: string;
  name: string;
  whatsapp: string;
  totalAppointments: number;
  lastAppointmentAt: string;
  lastServiceName: string;
  lastServicePrice: number;
  averageTicket: number;
  averageIntervalDays: number | null;
  daysSinceLastAppointment: number;
  isReturning: boolean;
};

export type LostCustomer = CustomerProfile & {
  daysWithoutAppointment: number;
};

export type AtRiskCustomer = CustomerProfile & {
  expectedReturnDays: number;
  daysLate: number;
};

export type RevenueSummary = {
  confirmedTotal: number;
  next7Days: number;
  next30Days: number;
  returnOpportunity: number;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizePhone(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function getCustomerKey(appointment: IntelligenceAppointment) {
  const phone = normalizePhone(appointment.customer_whatsapp);

  if (phone) {
    return `phone:${phone}`;
  }

  return `name:${normalizeText(appointment.customer_name || '')}`;
}

function getBrazilDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function dateKeyToUtc(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  return Date.UTC(year, month - 1, day);
}

function differenceInDays(from: string, to: string) {
  return Math.round(
    (dateKeyToUtc(to) - dateKeyToUtc(from)) /
      86400000,
  );
}

function getService(
  appointment: IntelligenceAppointment,
  services: Service[],
) {
  return services.find(
    (service) => service.id === appointment.service_id,
  );
}

function getServiceName(
  appointment: IntelligenceAppointment,
  services: Service[],
) {
  return (
    appointment.service?.name ||
    getService(appointment, services)?.name ||
    'Serviço'
  );
}

function getAppointmentPrice(
  appointment: IntelligenceAppointment,
  services: Service[],
) {
  const price = Number(appointment.price ?? 0);

  if (Number.isFinite(price) && price > 0) {
    return price;
  }

  return Number(
    getService(appointment, services)?.price ?? 0,
  );
}

function getConfirmedAppointments(
  appointments: IntelligenceAppointment[],
) {
  return appointments.filter(
    (appointment) =>
      appointment.status === 'confirmed' &&
      Boolean(appointment.starts_at),
  );
}

export function buildCustomerProfiles(
  appointments: IntelligenceAppointment[],
  services: Service[],
  referenceDate = new Date(),
): CustomerProfile[] {
  const confirmed = getConfirmedAppointments(appointments);

  const groups = new Map<
    string,
    IntelligenceAppointment[]
  >();

  for (const appointment of confirmed) {
    const key = getCustomerKey(appointment);
    const current = groups.get(key) ?? [];

    current.push(appointment);
    groups.set(key, current);
  }

  const profiles: CustomerProfile[] = [];

  for (const [key, customerAppointments] of groups) {
    const pastAppointments = customerAppointments
      .filter(
        (appointment) =>
          new Date(appointment.starts_at).getTime() <=
          referenceDate.getTime(),
      )
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() -
          new Date(b.starts_at).getTime(),
      );

    if (!pastAppointments.length) {
      continue;
    }

    const last =
      pastAppointments[pastAppointments.length - 1];

    const intervals: number[] = [];

    for (
      let index = 1;
      index < pastAppointments.length;
      index += 1
    ) {
      const previous = getBrazilDateKey(
        pastAppointments[index - 1].starts_at,
      );

      const current = getBrazilDateKey(
        pastAppointments[index].starts_at,
      );

      const interval = differenceInDays(
        previous,
        current,
      );

      if (interval >= 7 && interval <= 120) {
        intervals.push(interval);
      }
    }

    const averageIntervalDays = intervals.length
      ? Math.round(
          intervals.reduce(
            (total, interval) => total + interval,
            0,
          ) / intervals.length,
        )
      : null;

    const lastDate = getBrazilDateKey(
      last.starts_at,
    );

    const today = getBrazilDateKey(referenceDate);

    const daysSinceLastAppointment = Math.max(
      0,
      differenceInDays(lastDate, today),
    );

    const totalValue = pastAppointments.reduce(
      (total, appointment) =>
        total +
        getAppointmentPrice(
          appointment,
          services,
        ),
      0,
    );

    const averageTicket =
      pastAppointments.length > 0
        ? totalValue / pastAppointments.length
        : 0;

    profiles.push({
      key,
      name: last.customer_name || 'Cliente',
      whatsapp: last.customer_whatsapp || '',
      totalAppointments: pastAppointments.length,
      lastAppointmentAt: last.starts_at,
      lastServiceName: getServiceName(
        last,
        services,
      ),
      lastServicePrice: getAppointmentPrice(
        last,
        services,
      ),
      averageTicket,
      averageIntervalDays,
      daysSinceLastAppointment,
      isReturning:
        pastAppointments.length >= 2,
    });
  }

  return profiles.sort(
    (a, b) =>
      b.daysSinceLastAppointment -
      a.daysSinceLastAppointment,
  );
}

export function buildLostCustomers(
  appointments: IntelligenceAppointment[],
  services: Service[],
  referenceDate = new Date(),
): LostCustomer[] {
  return buildCustomerProfiles(
    appointments,
    services,
    referenceDate,
  )
    .filter(
      (customer) =>
        customer.totalAppointments >= 2 &&
        customer.averageIntervalDays !== null &&
        customer.daysSinceLastAppointment >
          customer.averageIntervalDays + 14,
    )
    .map((customer) => ({
      ...customer,
      daysWithoutAppointment:
        customer.daysSinceLastAppointment,
    }));
}

export function buildAtRiskCustomers(
  appointments: IntelligenceAppointment[],
  services: Service[],
  referenceDate = new Date(),
): AtRiskCustomer[] {
  return buildCustomerProfiles(
    appointments,
    services,
    referenceDate,
  )
    .filter(
      (customer) =>
        customer.totalAppointments >= 2 &&
        customer.averageIntervalDays !== null &&
        customer.daysSinceLastAppointment >
          customer.averageIntervalDays,
    )
    .map((customer) => {
      const expectedReturnDays =
        customer.averageIntervalDays as number;

      return {
        ...customer,
        expectedReturnDays,
        daysLate:
          customer.daysSinceLastAppointment -
          expectedReturnDays,
      };
    })
    .sort(
      (a, b) =>
        b.daysLate - a.daysLate,
    );
}

export function buildRevenueSummary(
  appointments: IntelligenceAppointment[],
  services: Service[],
  referenceDate = new Date(),
): RevenueSummary {
  const confirmed =
    getConfirmedAppointments(appointments);

  const now = referenceDate.getTime();

  const sevenDays =
    now + 7 * 86400000;

  const thirtyDays =
    now + 30 * 86400000;

  let confirmedTotal = 0;
  let next7Days = 0;
  let next30Days = 0;

  for (const appointment of confirmed) {
    const startsAt =
      new Date(
        appointment.starts_at,
      ).getTime();

    const price =
      getAppointmentPrice(
        appointment,
        services,
      );

    if (startsAt >= now) {
      confirmedTotal += price;
    }

    if (
      startsAt >= now &&
      startsAt <= sevenDays
    ) {
      next7Days += price;
    }

    if (
      startsAt >= now &&
      startsAt <= thirtyDays
    ) {
      next30Days += price;
    }
  }

  const customers =
    buildCustomerProfiles(
      appointments,
      services,
      referenceDate,
    );

  const returnOpportunity =
    customers
      .filter(
        (customer) =>
          customer.totalAppointments >= 2 &&
          customer.averageIntervalDays !== null &&
          customer.daysSinceLastAppointment >=
            customer.averageIntervalDays,
      )
      .reduce(
        (total, customer) =>
          total + customer.averageTicket,
        0,
      );

  return {
    confirmedTotal,
    next7Days,
    next30Days,
    returnOpportunity,
  };
}

export function getCustomerProfile(
  appointments: IntelligenceAppointment[],
  services: Service[],
  key: string,
  referenceDate = new Date(),
) {
  return (
    buildCustomerProfiles(
      appointments,
      services,
      referenceDate,
    ).find(
      (customer) =>
        customer.key === key,
    ) ?? null
  );
}

export function findCustomersForEmptySlot(
  profiles: CustomerProfile[],
  _startsAt: Date,
) {
  return profiles
    .filter((customer) => {
      if (!customer.whatsapp.trim()) {
        return false;
      }

      if (
        customer.totalAppointments < 2 ||
        customer.averageIntervalDays === null
      ) {
        return false;
      }

      return (
        customer.daysSinceLastAppointment >=
        customer.averageIntervalDays - 5
      );
    })
    .sort((a, b) => {
      const aDistance = Math.abs(
        a.daysSinceLastAppointment -
          (a.averageIntervalDays ?? 0),
      );

      const bDistance = Math.abs(
        b.daysSinceLastAppointment -
          (b.averageIntervalDays ?? 0),
      );

      return aDistance - bDistance;
    })
    .slice(0, 3);
}

export function formatCustomerDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(new Date(value));
}