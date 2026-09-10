export type Profile = {
  id: string;
  name: string;
  business_name: string;
  specialty: string;
  slug: string;
  avatar_url: string | null;
  whatsapp: string;
  phone: string;
  address: string;
  city: string;
  state: string;
};

export type Service = {
  id: string;
  profile_id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
};

export type BusinessHour = {
  id?: string;
  profile_id: string;
  day_of_week: number;
  is_open: boolean;
  start_time: string | null;
  end_time: string | null;
};

export type BlockedTime = {
  id: string;
  profile_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
};

export type Appointment = {
  id: string;
  profile_id: string;
  service_id: string;
  customer_name: string;
  customer_whatsapp: string;
  starts_at: string;
  ends_at: string;
  price: number;
  duration_minutes: number;
  status: 'confirmed' | 'cancelled';
  service?: Pick<Service, 'name'> | null;
};

export type BookingData = {
  profile: Profile;
  service: Service;
  date: string;
  time: string;
  customerName: string;
  customerWhatsapp: string;
};
