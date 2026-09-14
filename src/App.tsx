import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Scissors,
  Settings2,
  Trash2,
  UserRound,
  Upload,
  Image as ImageIcon,
  Palette,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  createAppointment,
  getAvailableSlots,
  getOwnerData,
  getPublicPixKey,
  getPublicProfile,
} from '@/services/data';
import type {
  Appointment,
  BlockedTime,
  BookingData,
  Profile,
  Service,
} from '@/types';
import {
  buildReturnRadar,
  generateReturnMessage,
  type ReturnRadarItem,
} from '@/utils/returnRadar';
import {
  dateKey,
  formatCurrency,
  formatDate,
  formatDuration,
  initials,
  slugify,
  whatsappUrl,
} from '@/utils/format';

const days = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

function brazilDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  });
}

function brazilDateKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function brazilTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function brazilShortDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  }).format(new Date(value)).replace('.', '');
}

const navItems = [
  ['/dashboard', 'Início'],
  ['/dashboard/agendamentos', 'Agendamentos'],
  ['/dashboard/servicos', 'Serviços'],
  ['/dashboard/horarios', 'Horários'],
  ['/dashboard/bloqueios', 'Bloqueios'],
  ['/dashboard/clientes-sumidos', 'Clientes sumidos'],
  ['/dashboard/clientes-em-risco', 'Clientes em risco'],
  ['/dashboard/agenda-vazia', 'Agenda vazia'],
  ['/dashboard/perfil-360', 'Perfil 360º'],
  ['/dashboard/o-que-fazer-hoje', 'O que fazer hoje'],
  ['/dashboard/previsao-faturamento', 'Previsão de faturamento'],
  ['/dashboard/perfil', 'Meu perfil'],
];

type PublicData = Awaited<ReturnType<typeof getPublicProfile>>;
type OwnerData = Awaited<ReturnType<typeof getOwnerData>>;
type CustomProfile = Profile & {
  logo_url?: string | null;
  description?: string | null;
  primary_color?: string | null;
  pix_key?: string | null;
};

function customProfile(profile: Profile): CustomProfile {
  return profile as CustomProfile;
}

type PaymentService = Service & {
  payment_type?: 'onsite' | 'deposit' | 'full' | null;
  requires_deposit?: boolean | null;
  deposit_amount?: number | null;
};

type PaymentAppointment = Omit<Appointment, 'service'> & {
  payment_confirmed?: boolean | null;
  service?: (Pick<Service, 'name'> & {
    payment_type?: 'onsite' | 'deposit' | 'full' | null;
    requires_deposit?: boolean | null;
    deposit_amount?: number | null;
  }) | null;
};

type PaymentProfile = CustomProfile;

function Button({
  children,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
}) {
  return (
    <button className={`button button-${variant}`} {...props}>
      {children}
    </button>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Avatar({
  profile,
  size = 'normal',
}: {
  profile?: Partial<Profile> | null;
  size?: 'normal' | 'large';
}) {
  return profile?.avatar_url ? (
    <img
      className={`avatar avatar-${size}`}
      src={profile.avatar_url}
      alt={profile.business_name || 'Perfil'}
    />
  ) : (
    <div className={`avatar avatar-${size}`}>
      {initials(profile?.business_name || profile?.name || '')}
    </div>
  );
}

function Brand() {
  return (
    <button
      type="button"
      className="brand brand-button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Ir para o topo"
    >
      <span>Apenas agenda</span>
    </button>
  );
}

function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CalendarDays size={20} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

function PublicPage({ slug }: { slug: string }) {
  const [data, setData] = useState<PublicData>();
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PaymentService | null>(null);
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<Partial<BookingData>>({});
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
  const [publicPixKey, setPublicPixKey] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    getPublicProfile(slug)
      .then(setData)
      .catch(() => setError('Não foi possível carregar este perfil.'));
  }, [slug]);

  const profile = data?.profile;
  const publicProfile = profile ? customProfile(profile) : null;
  const primaryColor = publicProfile?.primary_color || '#111111';
  const today = dateKey(new Date());

  const nextDays = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        return dateKey(date);
      }),
    [],
  );

  async function chooseDate(date: string) {
    if (!selected || !data) return;

    setBooking((current) => ({ ...current, date }));
    setLoadingSlots(true);
    setError('');

    try {
      setSlots(
        await getAvailableSlots(
          data.profile.id,
          date,
          selected.duration_minutes,
          data.hours,
          data.blocks,
          data.availability,
        ),
      );
    } catch {
      setError('Não foi possível consultar os horários.');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault();

    if (
      !data ||
      !selected ||
      !booking.date ||
      !booking.time ||
      !booking.customerName ||
      !booking.customerWhatsapp
    ) {
      return;
    }

    setSaving(true);
    setError('');

    try {
      const result = await createAppointment(
        data.profile.id,
        selected.id,
        booking.customerName,
        booking.customerWhatsapp,
        `${booking.date}T${booking.time}:00`,
      );

      const paymentType = selected.payment_type || (selected.requires_deposit
        ? (Number(selected.deposit_amount || 0) >= Number(selected.price || 0) ? 'full' : 'deposit')
        : 'onsite');

      if (paymentType !== 'onsite') {
        try {
          const pixKey = await getPublicPixKey(data.profile.id);
          setPublicPixKey(typeof pixKey === 'string' ? pixKey : '');
        } catch (pixError) {
          console.error('Erro ao buscar chave Pix pública:', pixError);
          setPublicPixKey('');
        }
      } else {
        setPublicPixKey('');
      }

      setConfirmed(result);
    } catch (err) {
      setError(
        String(err).includes('slot_taken')
          ? 'Esse horário acabou de ser ocupado. Escolha outro horário.'
          : 'Não foi possível confirmar. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) {
    return (
      <div className="center-page">
        <Brand />
        <div className="panel centered">
          <div className="eyebrow">Perfil não encontrado</div>
          <h1>Este link ainda não está disponível.</h1>
          <p>
            Confira o endereço ou peça à profissional para compartilhar o link
            correto.
          </p>
          <button type="button" className="button button-primary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Voltar ao topo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (!data || !profile) {
    return (
      <div className="center-page">
        <LoaderCircle className="spin" />
        <p>Carregando perfil...</p>
      </div>
    );
  }

  if (confirmed) {
    const paymentSelected = selected as PaymentService | null;
    const paymentType = ((paymentSelected as PaymentService | null)?.payment_type || (paymentSelected?.requires_deposit ? (Number(paymentSelected?.deposit_amount || 0) >= Number(paymentSelected?.price || 0) ? 'full' : 'deposit') : 'onsite')) as 'onsite' | 'deposit' | 'full';
    const requiresDeposit = paymentType !== 'onsite';
    const depositAmount = Number(paymentSelected?.deposit_amount || 0);
    const isFullPayment = paymentType === 'full';
    const pixKey = publicPixKey.trim();
    const whatsappMessage = requiresDeposit
      ? `Olá! Agendei ${selected?.name} para ${booking.date ? formatDate(booking.date) : ''} às ${booking.time} e já fiz o pagamento do ${isFullPayment ? 'serviço' : 'sinal'}.`
      : `Olá! Agendei ${selected?.name} para ${booking.date ? formatDate(booking.date) : ''} às ${booking.time}.`;

    return (
      <div className="public-shell" style={{ ['--profile-primary' as string]: primaryColor }}>
        <PublicNav profile={profile} onMenu={() => setMobileMenu(!mobileMenu)} open={mobileMenu} />
        <main className="confirmation">
          <div className="success-mark"><Check size={30} /></div>
          <div className="eyebrow">{requiresDeposit ? 'Solicitação recebida' : 'Agendamento confirmado'}</div>
          <h1>{requiresDeposit ? (isFullPayment ? 'Faça o pagamento do serviço.' : 'Falta apenas o sinal.') : 'Seu horário está reservado.'}</h1>
          <p>{requiresDeposit ? 'Faça o Pix abaixo e envie o comprovante pelo WhatsApp da profissional.' : 'Pronto. Enviamos todos os detalhes para você guardar.'}</p>
          <div className="booking-receipt">
            <div><span>Serviço</span><strong>{selected?.name}</strong></div>
            <div><span>Data e horário</span><strong>{booking.date && formatDate(booking.date)} · {booking.time}</strong></div>
            <div><span>Profissional</span><strong>{profile.business_name || profile.name}</strong></div>
          </div>
          {requiresDeposit && (
            <div className="pix-payment">
              <div className="pix-payment-top">
                <div><span className="eyebrow">{isFullPayment ? 'Pagamento final' : 'Sinal para reservar'}</span><h2>{formatCurrency(depositAmount)}</h2></div>
                <span className="pix-badge">Pix</span>
              </div>
              {pixKey ? (
                <>
                  <p>Copie a chave Pix, faça o pagamento e depois envie o comprovante.</p>
                  <div className="pix-key-box">
                    <span>{pixKey}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(pixKey)}><Copy size={16} /> Copiar</button>
                  </div>
                </>
              ) : <div className="pix-missing">A profissional ainda não cadastrou a chave Pix. Entre em contato pelo WhatsApp para concluir a reserva.</div>}
            </div>
          )}
          {profile.whatsapp ? (
            <a className="button button-primary" href={whatsappUrl(profile.whatsapp, whatsappMessage)} target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              {requiresDeposit ? 'Enviar comprovante pelo WhatsApp' : 'Falar com a profissional'}
            </a>
          ) : (
            <div className="pix-missing">
              Agendamento registrado. A profissional ainda não cadastrou o WhatsApp.
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="public-shell" style={{
      ['--profile-primary' as string]: primaryColor,
    } as React.CSSProperties}>
      <PublicNav
        profile={profile}
        onMenu={() => setMobileMenu(!mobileMenu)}
        open={mobileMenu}
      />

      <main>
        <section className="profile-hero">
          <div className="profile-image">
            <Avatar profile={profile} size="large" />
          </div>

          <div className="profile-content">
            <div className="eyebrow">Agendamento online</div>

            <h1>{profile.business_name || '[Nome do negócio]'}</h1>

            <p className="profile-specialty">
              {profile.specialty || '[Especialidade]'}
            </p>

            {publicProfile?.description && (
              <p className="profile-description">
                {publicProfile.description}
              </p>
            )}

            <div className="profile-facts">
              <span>
                <Clock3 size={16} /> Atendimento com hora marcada
              </span>

              {profile.address && (
                <span>
                  <MapPin size={16} /> {profile.address}
                  {profile.city ? ` · ${profile.city}` : ''}
                </span>
              )}
            </div>

            <Button
              style={{ backgroundColor: primaryColor }}
              onClick={() => {
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Agendar agora <ArrowRight size={17} />
            </Button>
          </div>
        </section>

        <section className="public-section" id="servicos">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Escolha seu momento</div>
              <h2>Serviços</h2>
            </div>

            <span>{data.services.length} opções</span>
          </div>

          {data.services.length ? (
            <div className="service-list">
              {data.services.map((service) => (
                <button
                  className="service-card"
                  key={service.id}
                  onClick={() => {
                    setSelected(service);
                    setStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <div>
                    <h3>{service.name}</h3>

                    {service.description && <p>{service.description}</p>}

                    <span className="service-duration">
                      <Clock3 size={14} />
                      {formatDuration(service.duration_minutes)}
                    </span>

                    {(service as PaymentService).payment_type === 'deposit' && (
                      <span className="service-deposit">
                        Sinal de {formatCurrency(Number((service as PaymentService).deposit_amount || 0))}
                      </span>
                    )}
                    {(service as PaymentService).payment_type === 'full' && (
                      <span className="service-deposit">Pagamento antecipado</span>
                    )}
                  </div>

                  <strong>{formatCurrency(service.price)}</strong>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Nenhum serviço cadastrado"
              text="A profissional ainda está preparando os serviços por aqui."
            />
          )}
        </section>

        <section className="contact-strip">
          <div>
            <div className="eyebrow">Precisa falar com ela?</div>
            <h2>Tem alguma dúvida?</h2>
            <p>Chame no WhatsApp para combinar os detalhes.</p>
          </div>

          {profile.whatsapp && (
            <a
              className="button button-dark"
              href={whatsappUrl(profile.whatsapp)}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={18} />
              Falar no WhatsApp
            </a>
          )}
        </section>

        <section className="location-section" id="localizacao">
          <div>
            <div className="eyebrow">Visite o espaço</div>
            <h2>Como chegar</h2>

            <p>
              {profile.address || '[Endereço]'}
              {profile.city ? `, ${profile.city}` : ''}
              {profile.state ? ` · ${profile.state}` : ''}
            </p>
          </div>

          {profile.address && (
            <a
              className="text-link"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${profile.address}, ${profile.city}, ${profile.state}`,
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no mapa <ExternalLink size={15} />
            </a>
          )}
        </section>
      </main>

      <footer>
        <Brand />
        <span>Agendamentos simples para pequenos negócios.</span>
      </footer>

      {step > 0 && (
        <BookingDrawer
          profile={profile}
          selected={selected}
          setSelected={setSelected}
          step={step}
          setStep={setStep}
          booking={booking}
          setBooking={setBooking}
          nextDays={nextDays}
          today={today}
          slots={slots}
          loadingSlots={loadingSlots}
          chooseDate={chooseDate}
          submitBooking={submitBooking}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

function PublicNav({
  profile,
  onMenu,
  open,
}: {
  profile: Profile;
  onMenu: () => void;
  open?: boolean;
}) {
  const custom = customProfile(profile);

  return (
    <header className="public-nav">
      <button
        type="button"
        className="brand brand-button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Ir para o topo"
      >
        {custom.logo_url ? (
          <img
            src={custom.logo_url}
            alt={custom.business_name || 'Logo'}
            style={{
              width: 34,
              height: 34,
              objectFit: 'contain',
              borderRadius: 10,
            }}
          />
        ) : null}
        <span>{custom.business_name || 'Apenas agenda'}</span>
      </button>

      <div className={`public-links ${open ? 'open' : ''}`}>
        <a href="#servicos">Serviços</a>
        <a href="#localizacao">Localização</a>
        {profile.whatsapp && (
          <a href={whatsappUrl(profile.whatsapp)} target="_blank" rel="noreferrer">
            Contato
          </a>
        )}
      </div>

      <button
        className="icon-button menu-button"
        onClick={onMenu}
        aria-label="Menu"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
  );
}

function BookingDrawer({
  profile,
  selected,
  setSelected,
  step,
  setStep,
  booking,
  setBooking,
  nextDays,
  today,
  slots,
  loadingSlots,
  chooseDate,
  submitBooking,
  saving,
  error,
}: {
  profile: Profile;
  selected: Service | null;
  setSelected: React.Dispatch<React.SetStateAction<Service | null>>;
  step: number;
  setStep: (value: number) => void;
  booking: Partial<BookingData>;
  setBooking: React.Dispatch<
    React.SetStateAction<Partial<BookingData>>
  >;
  nextDays: string[];
  today: string;
  slots: string[];
  loadingSlots: boolean;
  chooseDate: (date: string) => void;
  submitBooking: (event: FormEvent) => void;
  saving: boolean;
  error: string;
}) {
  return (
    <div className="booking-overlay">
      <div className="booking-panel">
        <div className="booking-top">
          <button
            className="icon-button"
            onClick={() => setStep(0)}
          >
            <X size={20} />
          </button>

          <div>
            <span>Agendar horário</span>
            <small>Passo {step} de 3</small>
          </div>

          <div className="step-dots">
            {[1, 2, 3].map((item) => (
              <i
                className={item <= step ? 'active' : ''}
                key={item}
              />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="booking-content">
            <div className="booking-heading">
              <span className="eyebrow">1 · Serviço</span>
              <h2>O que você quer fazer?</h2>
            </div>

            {selected ? (
              <div className="selected-service">
                <div>
                  <strong>{selected.name}</strong>
                  <span>
                    {formatDuration(selected.duration_minutes)} ·{' '}
                    {formatCurrency(selected.price)}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelected(null);
                    setStep(0);
                  }}
                >
                  Trocar
                </button>
              </div>
            ) : (
              <p className="muted">
                Volte e escolha um serviço para continuar.
              </p>
            )}

            <Button
              disabled={!selected}
              onClick={() => setStep(2)}
            >
              Continuar <ArrowRight size={17} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="booking-content">
            <div className="booking-heading">
              <button
                className="back-link"
                onClick={() => setStep(1)}
              >
                <ChevronLeft size={16} /> Voltar
              </button>

              <span className="eyebrow">2 · Data e horário</span>
              <h2>Quando fica melhor?</h2>
            </div>

            <div className="date-grid">
              {nextDays.map((date) => {
                const parsedDate = new Date(`${date}T12:00:00`);

                return (
                  <button
                    key={date}
                    className={
                      booking.date === date ? 'selected' : ''
                    }
                    onClick={() => chooseDate(date)}
                  >
                    <small>
                      {parsedDate
                        .toLocaleDateString('pt-BR', {
                          weekday: 'short',
                        })
                        .replace('.', '')}
                    </small>

                    <strong>{parsedDate.getDate()}</strong>

                    <span>
                      {date === today
                        ? 'Hoje'
                        : parsedDate
                            .toLocaleDateString('pt-BR', {
                              month: 'short',
                            })
                            .replace('.', '')}
                    </span>
                  </button>
                );
              })}
            </div>

            {booking.date && (
              <div className="slot-area">
                <span className="eyebrow">
                  Horários disponíveis
                </span>

                {loadingSlots ? (
                  <LoaderCircle className="spin" />
                ) : slots.length ? (
                  <div className="slot-grid">
                    {slots.map((slot) => (
                      <button
                        className={
                          booking.time === slot ? 'selected' : ''
                        }
                        key={slot}
                        onClick={() =>
                          setBooking((current) => ({
                            ...current,
                            time: slot,
                          }))
                        }
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Não há horários disponíveis nessa data.
                  </p>
                )}
              </div>
            )}

            <Button
              disabled={!booking.date || !booking.time}
              onClick={() => setStep(3)}
            >
              Continuar <ArrowRight size={17} />
            </Button>
          </div>
        )}

        {step === 3 && (
          <form
            className="booking-content"
            onSubmit={submitBooking}
          >
            <div className="booking-heading">
              <button
                type="button"
                className="back-link"
                onClick={() => setStep(2)}
              >
                <ChevronLeft size={16} /> Voltar
              </button>

              <span className="eyebrow">3 · Seus dados</span>
              <h2>Para confirmar seu horário</h2>
              <p>
                Sem cadastro. Só precisamos de duas informações.
              </p>
            </div>

            <Field
              label="Seu nome"
              placeholder="Como podemos te chamar?"
              value={booking.customerName || ''}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  customerName: event.target.value,
                }))
              }
              required
            />

            <Field
              label="WhatsApp"
              placeholder="(00) 00000-0000"
              value={booking.customerWhatsapp || ''}
              onChange={(event) =>
                setBooking((current) => ({
                  ...current,
                  customerWhatsapp: event.target.value,
                }))
              }
              required
            />

            {selected && (selected as PaymentService).requires_deposit && (
              <div className="booking-deposit-note">
                <span>{Number((selected as PaymentService).deposit_amount || 0) >= Number(selected.price || 0) ? 'Pagamento final' : 'Sinal para reservar'}</span>
                <strong>{formatCurrency(Number((selected as PaymentService).deposit_amount || 0))}</strong>
                <p>Após confirmar, você verá a chave Pix da profissional e poderá enviar o comprovante pelo WhatsApp.</p>
              </div>
            )}

            <div className="summary-mini">
              <span>Resumo</span>
              <strong>{selected?.name}</strong>
              <p>
                {booking.date && formatDate(booking.date)} ·{' '}
                {booking.time}
              </p>
              <b>
                {selected && formatCurrency(selected.price)}
              </b>
            </div>

            {error && <div className="form-error">{error}</div>}

            <Button type="submit" disabled={saving}>
              {saving ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}

              {saving
                ? 'Confirmando...'
                : 'Confirmar agendamento'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

async function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timeoutId = setTimeout(() => reject(new Error(message)), ms); });
  try { return await Promise.race([Promise.resolve(promise), timeout]); }
  finally { if (timeoutId) clearTimeout(timeoutId); }
}

function AuthPage({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      if (mode === 'login') {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }), 15000, 'O login demorou demais para responder. Verifique sua conexão e tente novamente.');
        if (error) throw error;
        window.location.href = '/dashboard';
        return;
      }
      const { data, error } = await withTimeout(supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } }), 20000, 'O cadastro demorou demais para responder. Verifique sua conexão e tente novamente.');
      if (error) throw error;
      if (!data.user) throw new Error('O Supabase não retornou o usuário após o cadastro.');

      if (!data.session) {
        setSuccess('Conta criada. Confira seu e-mail para confirmar a conta. Depois, volte aqui e entre com seu e-mail e senha.');
        return;
      }

      // O profile é criado automaticamente pelo trigger do Supabase.
      window.location.href = '/dashboard/perfil';
    } catch (err) {
      console.error('ERRO REAL DO SUPABASE:', err);
      const message = err instanceof Error ? err.message : typeof err === 'object' && err !== null ? ('message' in err && typeof err.message === 'string' ? err.message : JSON.stringify(err)) : String(err);
      setError(message);
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-aside"><Brand /><div><div className="eyebrow">Seu negócio, no seu ritmo</div><h1>Um link simples para uma agenda mais leve.</h1><p>Organize seus horários, apresente seus serviços e deixe suas clientes agendarem sozinhas.</p></div><span className="aside-note">Feito para profissionais independentes.</span></div>
      <main className="auth-card">
        <div className="mobile-brand"><Brand /></div>
        <div className="eyebrow">{mode === 'login' ? 'Bem-vinda de volta' : 'Comece por aqui'}</div>
        <h2>{mode === 'login' ? 'Entre na sua conta' : 'Crie sua conta'}</h2>
        <p className="auth-lead">{mode === 'login' ? 'Acesse seu painel e cuide da sua agenda.' : 'Leva menos de um minuto para começar.'}</p>
        <form onSubmit={submit}>
          {mode === 'signup' && <Field label="Seu nome" placeholder="Como você se chama?" value={name} onChange={(event) => setName(event.target.value)} required />}
          <Field label="E-mail" type="email" placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Field label="Senha" type="password" placeholder="Mínimo de 6 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required />
          {error && <div className="form-error">{error}</div>}
          {success && <div className="saved">{success}</div>}
          <Button type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : null}{mode === 'login' ? 'Entrar no painel' : 'Criar minha conta'}<ArrowRight size={17} /></Button>
        </form>
        <p className="switch-auth">{mode === 'login' ? 'Ainda não tem uma conta?' : 'Já tem uma conta?'}<button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess(''); }}>{mode === 'login' ? 'Criar agora' : 'Entrar'}</button></p>
      </main>
    </div>
  );
}

function Dashboard({ userId }: { userId: string }) {
  const [data, setData] = useState<OwnerData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(undefined);
    withTimeout(getOwnerData(userId), 15000, 'O painel demorou demais para carregar. Verifique sua conexão e tente novamente.')
      .then((result) => {
        if (!active) return;
        if (!result) { setError('Sua conta foi encontrada, mas o perfil ainda não foi criado. Confirme o e-mail e entre novamente.'); return; }
        setData(result);
      })
      .catch((err) => { if (!active) return; console.error('ERRO AO CARREGAR PAINEL:', err); setError(err instanceof Error ? err.message : 'Não foi possível carregar seu painel.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  if (loading) return <div className="center-page"><LoaderCircle className="spin" /><p>Carregando seu espaço...</p></div>;
  if (error || !data) return <div className="center-page"><div className="panel centered"><div className="eyebrow">Não foi possível abrir o painel</div><h1>{error || 'Seu perfil não foi encontrado.'}</h1><p>Se você acabou de criar a conta, confirme o e-mail e entre novamente.</p><Button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login'; }}>Voltar para o login</Button></div></div>;
  return <DashboardLayout data={data} setData={setData} />;
}

function DashboardLayout({
  data,
  setData,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
}) {
  const path = window.location.pathname;
  const [mobileNav, setMobileNav] = useState(false);

  const page =
    path === '/dashboard'
      ? 'overview'
      : path.split('/').pop() || 'overview';

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="dashboard-shell">
      <aside
        className={
          mobileNav ? 'sidebar open' : 'sidebar'
        }
      >
        <div className="sidebar-top">
          <Brand />

          <button
            className="icon-button"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="side-profile">
          <Avatar profile={data.profile} />

          <div>
            <strong>
              {data.profile.business_name ||
                'Seu negócio'}
            </strong>

            <span>
              {data.profile.specialty ||
                'Configure seu perfil'}
            </span>
          </div>
        </div>

        <nav>
          {navItems.map(([href, label]) => (
            <a
              key={href}
              className={path === href ? 'active' : ''}
              href={href}
              onClick={() => setMobileNav(false)}
            >
              {label === 'Início' ? (
                <CalendarDays size={17} />
              ) : label === 'Agendamentos' ? (
                <CalendarDays size={17} />
              ) : label === 'Serviços' ? (
                <Scissors size={17} />
              ) : label === 'Horários' ? (
                <Clock3 size={17} />
              ) : label === 'Bloqueios' ? (
                <Settings2 size={17} />
              ) : label === 'Clientes sumidos' || label === 'Clientes em risco' || label === 'Perfil 360º' ? (
                <UserRound size={17} />
              ) : label === 'Agenda vazia' ? (
                <Clock3 size={17} />
              ) : label === 'O que fazer hoje' ? (
                <Check size={17} />
              ) : label === 'Previsão de faturamento' ? (
                <Settings2 size={17} />
              ) : (
                <UserRound size={17} />
              )}

              {label}
            </a>
          ))}
        </nav>

        <button className="logout" onClick={logout}>
          <LogOut size={17} />
          Sair
        </button>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-top">
          <button
            className="icon-button mobile-only"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>

          <div>
            <span className="top-kicker">Seu espaço</span>

            <strong>
              {data.profile.business_name ||
                'Configure seu negócio'}
            </strong>
          </div>


          <a
            className="public-link"
            href={`/agendar/${data.profile.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Ver página pública
          </a>
        </header>

        <main className="dashboard-content">
          {page === 'overview' && <Overview data={data} />}

          {page === 'clientes-sumidos' && <IntelligencePage data={data} mode="lost" />}
          {page === 'clientes-em-risco' && <IntelligencePage data={data} mode="risk" />}
          {page === 'agenda-vazia' && <IntelligencePage data={data} mode="empty" />}
          {page === 'perfil-360' && <IntelligencePage data={data} mode="profile" />}
          {page === 'o-que-fazer-hoje' && <IntelligencePage data={data} mode="today" />}
          {page === 'previsao-faturamento' && <IntelligencePage data={data} mode="revenue" />}

          {page === 'agendamentos' && (
            <Appointments
              data={data}
              setData={setData}
            />
          )}

          {page === 'servicos' && (
            <Services data={data} setData={setData} />
          )}

          {page === 'horarios' && (
            <Hours data={data} setData={setData} />
          )}

          {page === 'bloqueios' && (
            <Blocks data={data} setData={setData} />
          )}

          {page === 'perfil' && (
            <ProfileSettings
              data={data}
              setData={setData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Overview({
  data,
}: {
  data: NonNullable<OwnerData>;
}) {
  const today = dateKey(new Date());
  const [selectedReturn, setSelectedReturn] = useState<ReturnRadarItem | null>(null);
  const [returnMessage, setReturnMessage] = useState('');
  const [showNoNext, setShowNoNext] = useState(false);

  const confirmedAppointments = useMemo(
    () => data.appointments.filter((item) => item.status === 'confirmed'),
    [data.appointments],
  );

  const todays = confirmedAppointments.filter(
    (item) => brazilDateKey(item.starts_at) === today,
  );

  const next = confirmedAppointments.find(
    (item) => new Date(item.starts_at) >= new Date(),
  );

  const radar = useMemo(
    () => buildReturnRadar(data.appointments as PaymentAppointment[], data.services),
    [data.appointments, data.services],
  );

  const revenue = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const future = confirmedAppointments.filter((item) => new Date(item.starts_at) >= now);
    const sum = (items: PaymentAppointment[]) =>
      items.reduce((total, item) => total + Number(item.price || 0), 0);
    return {
      confirmed: sum(future),
      next7: sum(future.filter((item) => new Date(item.starts_at) <= in7)),
      next30: sum(future.filter((item) => new Date(item.starts_at) <= in30)),
    };
  }, [confirmedAppointments]);

  function openReturnMessage(item: ReturnRadarItem) {
    setSelectedReturn(item);
    setReturnMessage(generateReturnMessage(item));
  }

  function closeReturnMessage() {
    setSelectedReturn(null);
    setReturnMessage('');
  }

  function openWhatsApp() {
    if (!selectedReturn || !selectedReturn.customerWhatsapp.trim()) return;
    const url = whatsappUrl(selectedReturn.customerWhatsapp, returnMessage);
    if (url === '#') return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function returnStatusText(item: ReturnRadarItem) {
    if (item.status === 'overdue') {
      return `${item.daysOverdue} ${item.daysOverdue === 1 ? 'dia' : 'dias'} atrasada`;
    }
    if (item.status === 'upcoming') {
      if (item.daysUntilReturn === 0) return 'Retorno previsto para hoje';
      if (item.daysUntilReturn === 1) return 'Retorno previsto para amanhã';
      return `Retorno previsto em ${item.daysUntilReturn} dias`;
    }
    return `Retorno previsto: ${formatReturnDate(item.expectedReturnAt)}`;
  }

  function formatReturnDate(value: string) {
    const date = new Date(`${value}T12:00:00Z`);
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
    });
  }

  const groups = [
    { key: 'overdue', title: 'Clientes atrasadas', eyebrow: 'Precisa de atenção', items: radar.overdue, className: 'radar-group overdue' },
    { key: 'upcoming', title: 'Próximas do retorno', eyebrow: 'Próximos dias', items: radar.upcoming, className: 'radar-group upcoming' },
  ];

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Visão geral</div>
          <h1>Bom te ver por aqui.</h1>
          <p>Agora sua agenda também ajuda você a decidir o que fazer.</p>
        </div>
        <a className="button button-primary" href="/dashboard/perfil">
          <Settings2 size={17} />
          Configurar perfil
        </a>
      </div>

      <div className="overview-grid">
        <div className="metric-card warm">
          <span>Hoje</span>
          <strong>{todays.length}</strong>
          <p>{todays.length === 1 ? 'agendamento marcado' : 'agendamentos marcados'}</p>
        </div>
        <div className="metric-card">
          <span>Radar de retorno</span>
          <strong>{radar.all.length}</strong>
          <p>clientes para acompanhar</p>
        </div>
        <div className="metric-card">
          <span>Sem próximo</span>
          <strong>{radar.noNext.length}</strong>
          <p>oportunidades de follow-up</p>
        </div>
      </div>

      <section className="dashboard-section intelligence-revenue overview-revenue">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Financeiro</div>
            <h2>Previsão de faturamento</h2>
          </div>
          <a className="text-link" href="/dashboard/previsao-faturamento">Ver detalhes <ArrowRight size={15} /></a>
        </div>
        <div className="intelligence-revenue-grid">
          <div><span>Agendado</span><strong>{formatCurrency(revenue.confirmed)}</strong><small>futuro confirmado</small></div>
          <div><span>Próximos 7 dias</span><strong>{formatCurrency(revenue.next7)}</strong><small>já reservado</small></div>
          <div><span>Próximos 30 dias</span><strong>{formatCurrency(revenue.next30)}</strong><small>já reservado</small></div>
          <div><span>Oportunidades</span><strong>{radar.noNext.length}</strong><small>clientes sem próximo agendamento</small></div>
        </div>
      </section>

      <section className="dashboard-section return-radar-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Radar de Retorno</div>
            <h2>Clientes que podem voltar</h2>
          </div>
          <span>{radar.all.length} oportunidades</span>
        </div>

        <div className="return-radar-summary">
          <div className="return-radar-stat overdue">
            <strong>{radar.overdue.length}</strong>
            <small>Atrasadas</small>
          </div>
          <div className="return-radar-stat upcoming">
            <strong>{radar.upcoming.length}</strong>
            <small>Próximas</small>
          </div>
          <button
            type="button"
            className={`return-radar-stat no-next ${showNoNext ? 'selected' : ''}`}
            onClick={() => setShowNoNext((value) => !value)}
          >
            <strong>{radar.noNext.length}</strong>
            <small>Sem próximo agendamento</small>
          </button>
        </div>

        {radar.all.length ? (
          <div className="return-radar-groups">
            {groups.map((group) =>
              group.items.length ? (
                <div className={group.className} key={group.key}>
                  <div className="return-radar-group-heading">
                    <div><span>{group.eyebrow}</span><h3>{group.title}</h3></div>
                    <strong>{group.items.length}</strong>
                  </div>
                  <div className="return-radar-list">
                    {group.items.slice(0, 5).map((item) => (
                      <div className="return-radar-card" key={`${item.customerWhatsapp || item.customerName}-${item.lastAppointmentAt}`}>
                        <div className="return-radar-main">
                          <strong>{item.customerName}</strong>
                          <span>{item.serviceName}</span>
                          <small>Último atendimento: {brazilShortDate(item.lastAppointmentAt)} · Retorno habitual: {item.habitualDays} dias</small>
                          <b>{returnStatusText(item)}</b>
                        </div>
                        {item.customerWhatsapp.trim() ? (
                          <button type="button" className="return-radar-message" onClick={() => openReturnMessage(item)}>
                            <MessageCircle size={15} /> Enviar mensagem
                          </button>
                        ) : <span className="return-radar-no-whatsapp">WhatsApp não cadastrado</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {showNoNext && (
              <div className="radar-group no-next expanded">
                <div className="return-radar-group-heading">
                  <div><span>Oportunidades</span><h3>Clientes sem próximo agendamento</h3></div>
                  <strong>{radar.noNext.length}</strong>
                </div>
                {radar.noNext.length ? (
                  <div className="return-radar-list">
                    {radar.noNext.map((item) => (
                      <div className="return-radar-card" key={`${item.customerWhatsapp || item.customerName}-${item.lastAppointmentAt}-no-next`}>
                        <div className="return-radar-main">
                          <strong>{item.customerName}</strong>
                          <span>{item.serviceName}</span>
                          <small>Último atendimento: {brazilShortDate(item.lastAppointmentAt)} · Retorno habitual: {item.habitualDays} dias</small>
                          <b>Boa oportunidade para follow-up</b>
                        </div>
                        {item.customerWhatsapp.trim() ? (
                          <button type="button" className="return-radar-message" onClick={() => openReturnMessage(item)}>
                            <MessageCircle size={15} /> WhatsApp
                          </button>
                        ) : <span className="return-radar-no-whatsapp">WhatsApp não cadastrado</span>}
                      </div>
                    ))}
                  </div>
                ) : <div className="intelligence-empty">Nenhuma cliente está sem próximo agendamento.</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="return-radar-empty">
            <div className="empty-icon"><Check size={19} /></div>
            <div><strong>Por enquanto, nenhuma cliente precisa de retorno.</strong><p>Quando houver uma oportunidade, ela aparecerá aqui automaticamente.</p></div>
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div><div className="eyebrow">Próximo atendimento</div><h2>Agenda</h2></div>
          <a className="text-link" href="/dashboard/agendamentos">Ver agenda <ArrowRight size={15} /></a>
        </div>
        {next ? <AppointmentCard appointment={next as PaymentAppointment} /> : <Empty title="Sua agenda está livre" text="Quando alguém marcar um horário, ele aparece aqui." />}
      </section>

      <section className="quick-actions">
        <a href="/dashboard/servicos"><Plus size={18} /><strong>Adicionar serviço</strong><span>Apresente o que você faz</span></a>
        <a href="/dashboard/horarios"><Clock3 size={18} /><strong>Configurar horários</strong><span>Defina quando atende</span></a>
        <a href={`/agendar/${data.profile.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={18} /><strong>Ver meu perfil</strong><span>Veja como suas clientes veem</span></a>
      </section>

      {selectedReturn && (
        <div className="return-message-overlay" role="dialog" aria-modal="true" aria-labelledby="return-message-title">
          <div className="return-message-modal">
            <div className="return-message-top">
              <div><span className="eyebrow">Radar de Retorno</span><h2 id="return-message-title">Enviar mensagem para {selectedReturn.customerName}</h2></div>
              <button type="button" className="icon-button" onClick={closeReturnMessage} aria-label="Fechar"><X size={18} /></button>
            </div>
            <label className="field return-message-field">
              <span>Mensagem</span>
              <textarea value={returnMessage} onChange={(event) => setReturnMessage(event.target.value)} autoFocus />
            </label>
            <div className="return-message-actions">
              <button type="button" className="button button-soft" onClick={closeReturnMessage}>Cancelar</button>
              <button type="button" className="button button-primary" onClick={openWhatsApp} disabled={!selectedReturn.customerWhatsapp.trim() || !returnMessage.trim()}>
                <MessageCircle size={17} /> Abrir WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IntelligencePage({
  data,
  mode,
}: {
  data: NonNullable<OwnerData>;
  mode: 'lost' | 'risk' | 'empty' | 'profile' | 'today' | 'revenue';
}) {
  type Customer = {
    key: string;
    name: string;
    whatsapp: string;
    totalAppointments: number;
    lastAppointmentAt: string;
    lastService: string;
    lastPrice: number;
    averageTicket: number;
    averageInterval: number | null;
    daysSinceLast: number;
    status: 'nova' | 'recorrente' | 'risco' | 'sumida';
    appointments: PaymentAppointment[];
  };

  const confirmedAppointments = useMemo(
    () => data.appointments.filter((item) => item.status === 'confirmed'),
    [data.appointments],
  );

  const customerProfiles = useMemo<Customer[]>(() => {
    const groups = new Map<string, PaymentAppointment[]>();
    const normalize = (value: string) =>
      value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const keyFor = (item: PaymentAppointment) =>
      item.customer_whatsapp?.replace(/\D/g, '') || normalize(item.customer_name);

    confirmedAppointments
      .filter((item) => new Date(item.starts_at) <= new Date())
      .forEach((item) => {
        const key = keyFor(item);
        const current = groups.get(key) || [];
        groups.set(key, [...current, item]);
      });

    const now = new Date();
    return Array.from(groups.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      const last = sorted[sorted.length - 1];
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) {
        const diff = (new Date(sorted[i].starts_at).getTime() - new Date(sorted[i - 1].starts_at).getTime()) / 86400000;
        if (diff >= 7 && diff <= 180) intervals.push(diff);
      }
      const averageInterval = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
      const daysSinceLast = Math.max(0, Math.floor((now.getTime() - new Date(last.starts_at).getTime()) / 86400000));
      let status: Customer['status'] = sorted.length === 1 ? 'nova' : 'recorrente';
      if (sorted.length >= 2 && averageInterval !== null) {
        if (daysSinceLast > averageInterval + 14) status = 'sumida';
        else if (daysSinceLast > averageInterval) status = 'risco';
      }
      return {
        key,
        name: last.customer_name || 'Cliente',
        whatsapp: last.customer_whatsapp || '',
        totalAppointments: sorted.length,
        lastAppointmentAt: last.starts_at,
        lastService: last.service?.name || 'Serviço',
        lastPrice: Number(last.price || 0),
        averageTicket: sorted.reduce((sum, item) => sum + Number(item.price || 0), 0) / sorted.length,
        averageInterval,
        daysSinceLast,
        status,
        appointments: sorted,
      };
    });
  }, [confirmedAppointments]);

  const lostCustomers = customerProfiles.filter((item) => item.status === 'sumida').sort((a, b) => b.daysSinceLast - a.daysSinceLast);
  const atRiskCustomers = customerProfiles.filter((item) => item.status === 'risco').sort((a, b) => b.daysSinceLast - a.daysSinceLast);

  const radar = useMemo(
    () => buildReturnRadar(data.appointments as PaymentAppointment[], data.services),
    [data.appointments, data.services],
  );

  const revenue = useMemo(() => {
    const now = new Date();
    const in7 = new Date(now);
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const future = confirmedAppointments.filter((item) => new Date(item.starts_at) >= now);
    const sum = (items: PaymentAppointment[]) => items.reduce((total, item) => total + Number(item.price || 0), 0);
    const next7 = future.filter((item) => new Date(item.starts_at) <= in7);
    const next30 = future.filter((item) => new Date(item.starts_at) <= in30);
    const returnOpportunity = customerProfiles
      .filter((item) => item.status === 'sumida' || item.status === 'risco')
      .reduce((total, item) => total + Number(item.averageTicket || 0), 0);
    return { confirmed: sum(future), next7: sum(next7), next30: sum(next30), returnOpportunity };
  }, [confirmedAppointments, customerProfiles]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  function openCustomerWhatsApp(customer: Customer) {
    if (!customer.whatsapp.trim()) return;
    const message = customer.status === 'sumida'
      ? `Oi, ${customer.name}! Tudo bem? Vi aqui que já faz um tempinho desde seu último atendimento de ${customer.lastService}. Queria saber se você gostaria de agendar novamente.`
      : `Oi, ${customer.name}! Tudo bem? Seu próximo atendimento costuma acontecer por volta de agora. Se quiser, posso te passar os horários disponíveis.`;
    const url = whatsappUrl(customer.whatsapp, message);
    if (url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
  }

  function statusLabel(status: Customer['status']) {
    if (status === 'nova') return 'Nova cliente';
    if (status === 'recorrente') return 'Recorrente';
    if (status === 'risco') return 'Em risco';
    return 'Cliente sumido';
  }

  const titleMap = {
    lost: ['Retenção', 'Clientes sumidos', 'Clientes que estão há mais tempo sem voltar.'],
    risk: ['Prevenção', 'Clientes em risco', 'Clientes se aproximando do intervalo em que costumam retornar.'],
    empty: ['Ocupação', 'Radar de agenda vazia', 'Encontre oportunidades para preencher horários livres.'],
    profile: ['Relacionamento', 'Perfil 360º', 'Veja o histórico e o valor de cada cliente em um só lugar.'],
    today: ['Inteligência', 'O que fazer hoje?', 'Priorize as ações que podem gerar resultado hoje.'],
    revenue: ['Financeiro', 'Previsão de faturamento', 'Acompanhe o que já está reservado e o potencial de retorno.'],
  } as const;

  const [eyebrow, title, description] = titleMap[mode];

  const actions = useMemo(() => {
    const result: Array<{ title: string; text: string; customer?: Customer; href?: string; action: string }> = [];
    if (radar.overdue.length) result.push({ title: `${radar.overdue.length} retorno${radar.overdue.length > 1 ? 's' : ''} atrasado${radar.overdue.length > 1 ? 's' : ''}`, text: 'Faça o follow-up enquanto a cliente ainda está próxima do período habitual.', action: 'Ver radar', href: '/dashboard' });
    if (lostCustomers.length) result.push({ title: `${lostCustomers.length} cliente${lostCustomers.length > 1 ? 's' : ''} sumido${lostCustomers.length > 1 ? 's' : ''}`, text: 'Retome o contato com quem já conhece seu trabalho.', action: 'Ver clientes', href: '/dashboard/clientes-sumidos' });
    if (atRiskCustomers.length) result.push({ title: `${atRiskCustomers.length} cliente${atRiskCustomers.length > 1 ? 's' : ''} em risco`, text: 'Antecipe o contato antes de perder o ritmo de retorno.', action: 'Ver clientes', href: '/dashboard/clientes-em-risco' });
    if (radar.noNext.length) result.push({ title: `${radar.noNext.length} cliente${radar.noNext.length > 1 ? 's' : ''} sem próximo agendamento`, text: 'São oportunidades diretas para preencher a agenda futura.', action: 'Ver oportunidades', href: '/dashboard' });
    return result.slice(0, 6);
  }, [radar, lostCustomers, atRiskCustomers]);

  const emptySlots = useMemo(() => {
    const results: Array<{ startsAt: string; customer: Customer; reason: string }> = [];
    const now = new Date();
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();
      const hour = data.hours.find((item) => item.day_of_week === dayOfWeek && item.is_open);
      if (!hour?.start_time || !hour?.end_time) continue;
      const available = data.availability.filter((slot) => slot.day_of_week === dayOfWeek && slot.active && slot.start_time);
      for (const slot of available) {
        const startsAt = `${dateKey(date)}T${slot.start_time}`;
        const startsDate = new Date(`${startsAt}-03:00`);
        if (startsDate <= now) continue;
        const occupied = confirmedAppointments.some((appointment) => {
          const start = new Date(appointment.starts_at).getTime();
          const end = new Date(appointment.ends_at).getTime();
          const target = startsDate.getTime();
          return target >= start && target < end;
        });
        if (occupied) continue;
        const candidate = lostCustomers[0] || atRiskCustomers[0] || customerProfiles.find((item) => item.status === 'recorrente');
        if (!candidate) continue;
        results.push({ startsAt: startsDate.toISOString(), customer: candidate, reason: candidate.status === 'sumida' ? 'Cliente sumido que pode voltar.' : candidate.status === 'risco' ? 'Cliente próxima do período habitual.' : 'Cliente recorrente para reativação.' });
        if (results.length >= 12) return results;
      }
    }
    return results;
  }, [data.hours, data.availability, confirmedAppointments, lostCustomers, atRiskCustomers, customerProfiles]);

  return (
    <>
      <div className="page-title">
        <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
        <a className="button button-primary" href="/dashboard">Voltar ao painel</a>
      </div>

      {mode === 'lost' && <CustomerListPage customers={lostCustomers} emptyText="Nenhum cliente sumido no momento." onSelect={setSelectedCustomer} onWhatsApp={openCustomerWhatsApp} />}
      {mode === 'risk' && <CustomerListPage customers={atRiskCustomers} emptyText="Nenhum cliente em risco no momento." onSelect={setSelectedCustomer} onWhatsApp={openCustomerWhatsApp} />}
      {mode === 'profile' && <CustomerListPage customers={customerProfiles} emptyText="Ainda não há histórico suficiente para criar perfis." onSelect={setSelectedCustomer} onWhatsApp={openCustomerWhatsApp} />}

      {mode === 'today' && (
        <section className="dashboard-section intelligence-today">
          <div className="section-heading"><div><div className="eyebrow">Prioridades</div><h2>Ações recomendadas</h2></div><span>{actions.length} ações</span></div>
          <div className="intelligence-actions">
            {actions.length ? actions.map((item) => <div className="intelligence-action" key={item.title}><div><strong>{item.title}</strong><p>{item.text}</p></div><a className="small-action intelligence-action-link" href={item.href || '/dashboard'}>{item.action}</a></div>) : <div className="intelligence-empty">Sua agenda está sob controle. Nenhuma ação prioritária foi identificada.</div>}
          </div>
        </section>
      )}

      {mode === 'revenue' && (
        <section className="dashboard-section intelligence-revenue">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Financeiro</div>
              <h2>Previsão de faturamento</h2>
            </div>
            <span>Visão futura</span>
          </div>
          <div className="intelligence-revenue-grid">
            <div><span>Agendado</span><strong>{formatCurrency(revenue.confirmed)}</strong><small>futuro confirmado</small></div>
            <div><span>Próximos 7 dias</span><strong>{formatCurrency(revenue.next7)}</strong><small>já reservado</small></div>
            <div><span>Próximos 30 dias</span><strong>{formatCurrency(revenue.next30)}</strong><small>já reservado</small></div>
            <div><span>Oportunidade</span><strong>{formatCurrency(revenue.returnOpportunity)}</strong><small>potencial de retorno</small></div>
          </div>
        </section>
      )}

      {mode === 'empty' && (
        <section className="dashboard-section intelligence-empty-slots">
          <div className="section-heading"><div><div className="eyebrow">Ocupação</div><h2>Horários com oportunidade</h2></div><span>{emptySlots.length} oportunidades</span></div>
          {emptySlots.length ? <div className="empty-slot-list">{emptySlots.map((item) => <div className="empty-slot-card" key={`${item.startsAt}-${item.customer.key}`}><div><strong>{brazilShortDate(item.startsAt)} · {brazilTime(item.startsAt)}</strong><span>Sugerir para {item.customer.name}</span><small>{item.reason}</small></div><button type="button" className="return-radar-message" onClick={() => openCustomerWhatsApp(item.customer)}><MessageCircle size={15} /> Chamar</button></div>)}</div> : <div className="intelligence-empty">Nenhum horário livre próximo com uma sugestão clara de cliente.</div>}
        </section>
      )}

      {selectedCustomer && (
        <div className="return-message-overlay" role="dialog" aria-modal="true">
          <div className="customer-profile-modal">
            <div className="return-message-top"><div><span className="eyebrow">Perfil 360º</span><h2>{selectedCustomer.name}</h2></div><button type="button" className="icon-button" onClick={() => setSelectedCustomer(null)} aria-label="Fechar"><X size={18} /></button></div>
            <div className="customer-profile-status">{statusLabel(selectedCustomer.status)}</div>
            <div className="customer-profile-grid">
              <div><span>WhatsApp</span><strong>{selectedCustomer.whatsapp || 'Não cadastrado'}</strong></div>
              <div><span>Atendimentos</span><strong>{selectedCustomer.totalAppointments}</strong></div>
              <div><span>Último serviço</span><strong>{selectedCustomer.lastService}</strong></div>
              <div><span>Retorno habitual</span><strong>{selectedCustomer.averageInterval === null ? 'Ainda sem padrão' : `${Math.round(selectedCustomer.averageInterval)} dias`}</strong></div>
              <div><span>Sem agendar</span><strong>{selectedCustomer.daysSinceLast} dias</strong></div>
              <div><span>Último atendimento</span><strong>{brazilShortDate(selectedCustomer.lastAppointmentAt)}</strong></div>
            </div>
            <div className="customer-history"><span className="eyebrow">Histórico recente</span>{selectedCustomer.appointments.slice(-5).reverse().map((appointment) => <div key={appointment.id}><span>{brazilShortDate(appointment.starts_at)}</span><strong>{appointment.service?.name || 'Serviço'}</strong></div>)}</div>
            <div className="return-message-actions"><button type="button" className="button button-soft" onClick={() => setSelectedCustomer(null)}>Fechar</button>{selectedCustomer.whatsapp && <button type="button" className="button button-primary" onClick={() => openCustomerWhatsApp(selectedCustomer)}><MessageCircle size={17} /> Chamar no WhatsApp</button>}</div>
          </div>
        </div>
      )}
    </>
  );
}

function CustomerListPage({
  customers,
  emptyText,
  onSelect,
  onWhatsApp,
}: {
  customers: Array<{
    key: string;
    name: string;
    whatsapp: string;
    totalAppointments: number;
    lastAppointmentAt: string;
    lastService: string;
    lastPrice: number;
    averageTicket: number;
    averageInterval: number | null;
    daysSinceLast: number;
    status: 'nova' | 'recorrente' | 'risco' | 'sumida';
    appointments: PaymentAppointment[];
  }>;
  emptyText: string;
  onSelect: (customer: {
    key: string;
    name: string;
    whatsapp: string;
    totalAppointments: number;
    lastAppointmentAt: string;
    lastService: string;
    lastPrice: number;
    averageTicket: number;
    averageInterval: number | null;
    daysSinceLast: number;
    status: 'nova' | 'recorrente' | 'risco' | 'sumida';
    appointments: PaymentAppointment[];
  }) => void;
  onWhatsApp: (customer: {
    key: string;
    name: string;
    whatsapp: string;
    totalAppointments: number;
    lastAppointmentAt: string;
    lastService: string;
    lastPrice: number;
    averageTicket: number;
    averageInterval: number | null;
    daysSinceLast: number;
    status: 'nova' | 'recorrente' | 'risco' | 'sumida';
    appointments: PaymentAppointment[];
  }) => void;
}) {
  if (!customers.length) return <section className="dashboard-section"><div className="intelligence-empty">{emptyText}</div></section>;
  return <section className="dashboard-section intelligence-list-section"><div className="intelligence-customer-list">{customers.map((customer) => <div className="intelligence-customer" key={customer.key}><button type="button" className="intelligence-customer-main" onClick={() => onSelect(customer)}><div><strong>{customer.name}</strong><span>{customer.lastService} · último atendimento {brazilShortDate(customer.lastAppointmentAt)}</span><small>{customer.daysSinceLast} dias desde o último atendimento</small></div><ArrowRight size={16} /></button>{customer.whatsapp && <button type="button" className="return-radar-message" onClick={() => onWhatsApp(customer)}><MessageCircle size={15} /> WhatsApp</button>}</div>)}</div></section>;
}

function AppointmentCard({
  appointment,
  onCancel,
  onTogglePayment,
}: {
  appointment: PaymentAppointment;
  onCancel?: () => void | Promise<void>;
  onTogglePayment?: (
    appointment: PaymentAppointment,
  ) => void | Promise<void>;
}) {
  const paymentType =
    appointment.service?.payment_type ||
    (appointment.service?.requires_deposit
      ? Number(appointment.service?.deposit_amount || 0) >=
        Number(appointment.price || 0)
        ? 'full'
        : 'deposit'
      : 'onsite');

  const requiresPayment =
    paymentType === 'deposit' || paymentType === 'full';

  const paymentLabel =
    paymentType === 'deposit' ? 'Sinal' : 'Pagamento';

  return (
    <div className="appointment-card">
      <div className="appointment-time">
        <strong>{brazilTime(appointment.starts_at)}</strong>

        <span>{brazilShortDate(appointment.starts_at)}</span>
      </div>

      <div className="appointment-info">
        <strong>{appointment.customer_name}</strong>

        <span>
          {appointment.service?.name || 'Serviço'}
        </span>

        <a
          href={whatsappUrl(
            appointment.customer_whatsapp,
          )}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={14} />
          {appointment.customer_whatsapp}
        </a>
      </div>

      <div className="appointment-actions">
        <div className="appointment-price">
          {formatCurrency(appointment.price)}
        </div>

        {requiresPayment && onTogglePayment && (
          <button
            type="button"
            className={`payment-status-button ${
              appointment.payment_confirmed
                ? 'confirmed'
                : 'pending'
            }`}
            onClick={() => onTogglePayment(appointment)}
            title={
              appointment.payment_confirmed
                ? `${paymentLabel} confirmado. Clique para marcar como pendente.`
                : `Marcar ${paymentLabel.toLowerCase()} como recebido`
            }
          >
            <span className="payment-status-dot" />
            {appointment.payment_confirmed
              ? `${paymentLabel} recebido`
              : `${paymentLabel} pendente`}
          </button>
        )}

        {onCancel && (
          <button
            type="button"
            className="cancel-link"
            onClick={onCancel}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function Appointments({
  data,
  setData,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
}) {
  const [filter, setFilter] = useState<
    'upcoming' | 'all'
  >('upcoming');

  const appointments = data.appointments.filter(
    (item) =>
      filter === 'all' ||
      (item.status === 'confirmed' &&
        new Date(item.starts_at) >= new Date()),
  );

  async function cancel(id: string) {
    if (!window.confirm('Cancelar este agendamento?')) {
      return;
    }

    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (!error) {
      setData({
        ...data,
        appointments: data.appointments.map(
          (item) =>
            item.id === id
              ? { ...item, status: 'cancelled' }
              : item,
        ),
      });
    }
  }

  async function togglePayment(
    appointment: PaymentAppointment,
  ) {
    const nextValue = !Boolean(appointment.payment_confirmed);

    const { error } = await supabase
      .from('appointments')
      .update({ payment_confirmed: nextValue })
      .eq('id', appointment.id)
      .eq('professional_id', data.profile.id);

    if (error) {
      console.error(
        'Erro ao atualizar status do pagamento:',
        error,
      );
      alert(
        'Não foi possível atualizar o status do pagamento.',
      );
      return;
    }

    setData({
      ...data,
      appointments: data.appointments.map((item) =>
        item.id === appointment.id
          ? ({
              ...item,
              payment_confirmed: nextValue,
            } as Appointment)
          : item,
      ),
    });
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Sua agenda</div>
          <h1>Agendamentos</h1>
          <p>
            Veja e organize seus próximos horários.
          </p>
        </div>

        <div className="tabs">
          <button
            className={
              filter === 'upcoming' ? 'active' : ''
            }
            onClick={() => setFilter('upcoming')}
          >
            Próximos
          </button>

          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
        </div>
      </div>

      <section className="dashboard-section">
        {appointments.length ? (
          <div className="appointment-list">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment as PaymentAppointment}
                onCancel={
                  appointment.status === 'confirmed'
                    ? () => cancel(appointment.id)
                    : undefined
                }
                onTogglePayment={
                  appointment.status === 'confirmed'
                    ? togglePayment
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <Empty
            title="Nenhum agendamento por aqui"
            text="Compartilhe seu link para começar a receber horários."
            action={
              <a
                className="button button-soft"
                href={`/agendar/${data.profile.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Ver página pública
              </a>
            }
          />
        )}
      </section>
    </>
  );
}

function Services({
  data,
  setData,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<React.SetStateAction<OwnerData | undefined>>;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '60',
    payment_type: 'onsite' as 'onsite' | 'deposit' | 'full',
    deposit_amount: '',
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setForm({
      name: '',
      description: '',
      price: '',
      duration_minutes: '60',
      payment_type: 'onsite',
      deposit_amount: '',
    });
    setEditing(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const price = Number(form.price);
    const duration = Number(form.duration_minutes);
    const deposit = Number(form.deposit_amount);

    if (!form.name.trim()) {
      window.alert('Informe o nome do serviço.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      window.alert('Informe um preço válido.');
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      window.alert('Informe uma duração válida.');
      return;
    }
    if (form.payment_type === 'deposit') {
      if (!Number.isFinite(deposit) || deposit <= 0) {
        window.alert('Informe um valor de sinal maior que zero.');
        return;
      }
      if (deposit > price) {
        window.alert('O sinal não pode ser maior que o preço do serviço.');
        return;
      }
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      duration_minutes: duration,
      profile_id: data.profile.id,
      is_active: true,
      payment_type: form.payment_type,
      requires_deposit: form.payment_type !== 'onsite',
      deposit_amount:
        form.payment_type === 'full'
          ? price
          : form.payment_type === 'deposit'
            ? deposit
            : null,
    };

    try {
      const result = editing
        ? await supabase
            .from('services')
            .update(payload)
            .eq('id', editing)
            .eq('profile_id', data.profile.id)
            .select()
            .maybeSingle()
        : await supabase
            .from('services')
            .insert(payload)
            .select()
            .maybeSingle();

      if (result.error) throw result.error;
      if (!result.data) throw new Error('O serviço não foi retornado pelo Supabase.');

      const savedService = result.data as Service;
      setData({
        ...data,
        services: editing
          ? data.services.map((item) => item.id === editing ? savedService : item)
          : [...data.services, savedService],
      });
      resetForm();
    } catch (error) {
      console.error('ERRO AO SALVAR SERVIÇO:', error);
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar o serviço.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este serviço?')) return;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('profile_id', data.profile.id);

    if (error) {
      window.alert(`Não foi possível excluir: ${error.message}`);
      return;
    }

    setData({ ...data, services: data.services.filter((item) => item.id !== id) });
    if (editing === id) resetForm();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">O que você oferece</div>
          <h1>Serviços</h1>
          <p>Mostre suas opções de forma clara para suas clientes.</p>
        </div>
      </div>

      <div className="two-column">
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Seus serviços</h2>
            <span>{data.services.length} cadastrados</span>
          </div>

          {data.services.length ? (
            <div className="service-admin-list">
              {data.services.map((service) => {
                const item = service as PaymentService;
                const type = item.payment_type || (item.requires_deposit ? 'deposit' : 'onsite');
                return (
                  <div className={`service-admin ${!service.is_active ? 'inactive' : ''}`} key={service.id}>
                    <div>
                      <strong>{service.name}</strong>
                      <span>
                        {formatCurrency(service.price)} · {formatDuration(service.duration_minutes)}
                        {type === 'deposit' && item.deposit_amount != null ? ` · Sinal de ${formatCurrency(item.deposit_amount)}` : ''}
                        {type === 'full' ? ' · Pagamento antecipado' : ''}
                      </span>
                    </div>
                    <div>
                      <button
                        className="small-action"
                        type="button"
                        onClick={() => {
                          setEditing(service.id);
                          setForm({
                            name: service.name,
                            description: service.description || '',
                            price: String(service.price),
                            duration_minutes: String(service.duration_minutes),
                            payment_type: type as 'onsite' | 'deposit' | 'full',
                            deposit_amount: item.deposit_amount != null && type === 'deposit' ? String(item.deposit_amount) : '',
                          });
                        }}
                      >Editar</button>
                      <button className="small-action danger" type="button" onClick={() => remove(service.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty title="Nenhum serviço cadastrado" text="Adicione seu primeiro serviço para começar." />
          )}
        </section>

        <form className="form-card" onSubmit={save}>
          <div className="section-heading">
            <h2>{editing ? 'Editar serviço' : 'Novo serviço'}</h2>
            {editing && <button type="button" className="text-link" onClick={resetForm}>Cancelar</button>}
          </div>

          <Field label="Nome do serviço" placeholder="Ex.: Corte e finalização" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />

          <label className="field">
            <span>Descrição <em>Opcional</em></span>
            <textarea placeholder="Descreva brevemente o serviço" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>

          <div className="form-row">
            <Field label="Preço" type="number" min="0" step="0.01" placeholder="0,00" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
            <label className="field">
              <span>Duração</span>
              <select value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })}>
                <option value="30">30 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1h30</option>
                <option value="120">2 horas</option>
                <option value="150">2h30</option>
                <option value="180">3 horas</option>
              </select>
            </label>
          </div>

          <div className="service-payment-settings">
            <div>
              <h3>Pagamento do serviço</h3>
              <p>Defina o que a cliente precisa pagar para reservar.</p>
            </div>
            <label className="field">
              <span>Forma de pagamento</span>
              <select value={form.payment_type} onChange={(event) => setForm({ ...form, payment_type: event.target.value as 'onsite' | 'deposit' | 'full' })}>
                <option value="onsite">Pagar no ato do serviço</option>
                <option value="deposit">Pagar um sinal para reservar</option>
                <option value="full">Pagar o valor completo antecipadamente</option>
              </select>
            </label>
            {form.payment_type === 'deposit' && (
              <Field label="Valor do sinal" type="number" min="0.01" step="0.01" placeholder="0,00" value={form.deposit_amount} onChange={(event) => setForm({ ...form, deposit_amount: event.target.value })} required />
            )}
            {form.payment_type === 'full' && (
              <div className="payment-final-value">
                <span>Valor cobrado antecipadamente</span>
                <strong>{form.price ? formatCurrency(Number(form.price)) : 'R$ 0,00'}</strong>
                <small>A cliente verá o valor completo na confirmação.</small>
              </div>
            )}
          </div>

          <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : <><Plus size={17} />Adicionar serviço</>}</Button>
        </form>
      </div>
    </>
  );
}


function Hours({
  data,
  setData,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<React.SetStateAction<OwnerData | undefined>>;
}) {
  type LocalHour = {
    profile_id: string;
    day_of_week: number;
    is_open: boolean;
    start_time: string | null;
    end_time: string | null;
  };

  const initialHours: LocalHour[] = days.map((_, index) => {
    const existing = data.hours.find((item) => item.day_of_week === index);
    return existing
      ? {
          profile_id: data.profile.id,
          day_of_week: index,
          is_open: Boolean(existing.is_open),
          start_time: existing.start_time || null,
          end_time: existing.end_time || null,
        }
      : {
          profile_id: data.profile.id,
          day_of_week: index,
          is_open: false,
          start_time: null,
          end_time: null,
        };
  });

  const [hours, setHours] = useState<LocalHour[]>(initialHours);
  const [interval, setInterval] = useState(() => {
    const slots = data.availability.map((slot) => slot.start_time.slice(0, 5)).sort();
    for (let i = 1; i < slots.length; i += 1) {
      const [h1, m1] = slots[i - 1].split(':').map(Number);
      const [h2, m2] = slots[i].split(':').map(Number);
      const diff = h2 * 60 + m2 - (h1 * 60 + m1);
      if (diff > 0 && [15, 30, 45, 60, 90, 120].includes(diff)) return String(diff);
    }
    return '30';
  });
  const [saving, setSaving] = useState(false);

  function updateHour(index: number, changes: Partial<LocalHour>) {
    setHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  }

  function generateSlots(startTime: string | null, endTime: string | null, stepMinutes: number) {
    if (!startTime || !endTime || !Number.isFinite(stepMinutes) || stepMinutes <= 0) return [];
    const [startHour, startMinute] = startTime.slice(0, 5).split(':').map(Number);
    const [endHour, endMinute] = endTime.slice(0, 5).split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const result: string[] = [];
    for (let minutes = start; minutes < end; minutes += stepMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      result.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return result;
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const stepMinutes = Number(interval);
      if (!Number.isFinite(stepMinutes) || ![15, 30, 45, 60, 90, 120].includes(stepMinutes)) {
        throw new Error('Escolha um intervalo válido.');
      }

      for (const hour of hours) {
        if (hour.is_open && (!hour.start_time || !hour.end_time)) {
          throw new Error(`Informe o início e o fim de ${days[hour.day_of_week]}.`);
        }
        if (hour.is_open && hour.start_time && hour.end_time && hour.start_time >= hour.end_time) {
          throw new Error(`O horário final deve ser depois do início em ${days[hour.day_of_week]}.`);
        }

        const payload = {
          profile_id: data.profile.id,
          professional_id: data.profile.id,
          day_of_week: hour.day_of_week,
          is_open: hour.is_open,
          active: hour.is_open,
          start_time: hour.is_open ? hour.start_time : null,
          end_time: hour.is_open ? hour.end_time : null,
        };

        const { error } = await supabase
          .from('business_hours')
          .upsert(payload, { onConflict: 'profile_id,day_of_week' });
        if (error) throw error;
      }

      const { error: deleteError } = await supabase
        .from('availability_slots')
        .delete()
        .eq('profile_id', data.profile.id);
      if (deleteError) throw deleteError;

      const rows = hours.flatMap((hour) =>
        hour.is_open
          ? generateSlots(hour.start_time, hour.end_time, stepMinutes).map((time) => ({
              profile_id: data.profile.id,
              day_of_week: hour.day_of_week,
              start_time: time,
              active: true,
            }))
          : [],
      );

      let savedAvailability: typeof data.availability = [];
      if (rows.length) {
        const { data: inserted, error } = await supabase
          .from('availability_slots')
          .insert(rows)
          .select('*')
          .order('day_of_week')
          .order('start_time');
        if (error) throw error;
        savedAvailability = (inserted || []) as typeof data.availability;
      }

      setData({ ...data, hours: hours as typeof data.hours, availability: savedAvailability });
      window.alert('Horários salvos com sucesso.');
    } catch (error) {
      console.error('ERRO AO SALVAR HORÁRIOS:', error);
      window.alert(error instanceof Error ? error.message : 'Não foi possível salvar os horários.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Configure sua agenda</div>
          <h1>Horários</h1>
          <p>Defina seu horário de atendimento e o intervalo entre os horários disponíveis.</p>
        </div>
        <Button onClick={save} disabled={saving}><Check size={17} />{saving ? 'Salvando...' : 'Salvar horários'}</Button>
      </div>

      <section className="hours-card">
        <div className="hours-settings">
          <div>
            <strong>Intervalo dos horários</strong>
            <p>O sistema cria automaticamente os horários dentro do seu período de atendimento.</p>
          </div>
          <label className="field interval-field">
            <span>Intervalo</span>
            <select value={interval} onChange={(event) => setInterval(event.target.value)}>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1h30</option>
              <option value="120">2 horas</option>
            </select>
          </label>
        </div>

        <div className="hours-list">
          {hours.map((hour, index) => (
            <div className="hours-row" key={hour.day_of_week}>
              <div className="day-toggle">
                <button type="button" className={hour.is_open ? 'toggle on' : 'toggle'} onClick={() => updateHour(index, { is_open: !hour.is_open })}><i /></button>
                <strong>{days[index]}</strong>
              </div>
              {hour.is_open ? (
                <div className="time-inputs">
                  <input type="time" value={hour.start_time || ''} onChange={(event) => updateHour(index, { start_time: event.target.value || null })} />
                  <span>até</span>
                  <input type="time" value={hour.end_time || ''} onChange={(event) => updateHour(index, { end_time: event.target.value || null })} />
                </div>
              ) : <span className="closed">Fechado</span>}
              {hour.is_open && hour.start_time && hour.end_time && hour.start_time < hour.end_time && (
                <span className="hours-preview">{generateSlots(hour.start_time, hour.end_time, Number(interval)).length} horários · a cada {interval} min</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}


function Blocks({
  data,
  setData
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
}) {
  const [form, setForm] = useState({
    starts_at: '',
    ends_at: '',
    reason: '',
  });

  async function add(event: FormEvent) {
    event.preventDefault();

    const startsAt = new Date(form.starts_at);
    const endsAt = new Date(form.ends_at);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      window.alert('Informe início e fim válidos.');
      return;
    }

    if (endsAt <= startsAt) {
      window.alert('O fim do bloqueio deve ser depois do início.');
      return;
    }

    const result = await supabase
      .from('blocked_times')
      .insert({
        profile_id: data.profile.id,
        professional_id: data.profile.id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        start_at: startsAt.toISOString(),
        end_at: endsAt.toISOString(),
        reason: form.reason.trim() || null,
      })
      .select()
      .maybeSingle();

    if (result.error) {
      console.error('ERRO AO ADICIONAR BLOQUEIO:', result.error);
      window.alert('Não foi possível adicionar o bloqueio.');
      return;
    }

    if (result.data) {
      setData({
        ...data,
        blocks: [
          ...data.blocks,
          result.data as BlockedTime,
        ],
      });

      setForm({
        starts_at: '',
        ends_at: '',
        reason: '',
      });
    }
  }

  async function remove(id: string) {
    const result = await supabase
      .from('blocked_times')
      .delete()
      .eq('id', id);

    if (!result.error) {
      setData({
        ...data,
        blocks: data.blocks.filter(
          (item) => item.id !== id,
        ),
      });
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            Exceções na agenda
          </div>
          <h1>Bloqueios</h1>
          <p>
            Reserve períodos em que você não estará
            disponível.
          </p>
        </div>
      </div>

      <div className="two-column">
        <section className="dashboard-section">
          <div className="section-heading">
            <h2>Períodos bloqueados</h2>
          </div>

          {data.blocks.length ? (
            <div className="block-list">
              {data.blocks.map((block) => (
                <div
                  className="block-row"
                  key={block.id}
                >
                  <div>
                    <strong>
                      {new Date(
                        block.starts_at,
                      ).toLocaleDateString('pt-BR')}
                    </strong>

                    <span>
                      {new Date(
                        block.starts_at,
                      ).toLocaleTimeString(
                        'pt-BR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}{' '}
                      —{' '}
                      {new Date(
                        block.ends_at,
                      ).toLocaleTimeString(
                        'pt-BR',
                        {
                          hour: '2-digit',
                          minute: '2-digit',
                        },
                      )}
                    </span>
                  </div>

                  <div>
                    <span>
                      {block.reason ||
                        'Indisponível'}
                    </span>

                    <button
                      className="small-action danger"
                      onClick={() =>
                        remove(block.id)
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Nenhum horário bloqueado"
              text="Tudo livre por enquanto."
            />
          )}
        </section>

        <form className="form-card" onSubmit={add}>
          <h2>Novo bloqueio</h2>

          <label className="field">
            <span>Começa em</span>
            <input
              type="datetime-local"
              value={form.starts_at}
              onChange={(event) =>
                setForm({
                  ...form,
                  starts_at: event.target.value,
                })
              }
              required
            />
          </label>

          <label className="field">
            <span>Termina em</span>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(event) =>
                setForm({
                  ...form,
                  ends_at: event.target.value,
                })
              }
              required
            />
          </label>

          <Field
            label="Motivo"
            placeholder="Ex.: Compromisso pessoal"
            value={form.reason}
            onChange={(event) =>
              setForm({
                ...form,
                reason: event.target.value,
              })
            }
          />

          <Button type="submit">
            <Plus size={17} />
            Adicionar bloqueio
          </Button>
        </form>
      </div>
    </>
  );
}

function ProfileSettings({
  data,
  setData,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<React.SetStateAction<OwnerData | undefined>>;
}) {
  const [form, setForm] = useState<CustomProfile>(customProfile(data.profile));
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'avatar' | null>(null);
  const [error, setError] = useState('');

  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    field: 'logo' | 'avatar',
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Escolha uma imagem válida.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setUploading(field);
    setError('');

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${form.id}/${field}-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-media')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('profile-media')
        .getPublicUrl(path);

      const column = field === 'logo' ? 'logo_url' : 'avatar_url';
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ [column]: publicData.publicUrl })
        .eq('id', form.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const next = customProfile(updated as Profile);
      setForm(next);
      setData({ ...data, profile: updated as Profile });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.');
    } finally {
      setUploading(null);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');

    const slug = slugify(form.slug) || `profissional-${form.id.slice(0, 8)}`;
    const primaryColor = form.primary_color || '#111111';

    const result = await supabase
      .from('profiles')
      .update({
        name: form.name,
        business_name: form.business_name,
        specialty: form.specialty,
        slug,
        whatsapp: form.whatsapp,
        phone: form.phone,
        address: form.address,
        city: form.city,
        state: form.state,
        description: form.description || '',
        primary_color: primaryColor,
        pix_key: form.pix_key || '',
      })
      .eq('id', form.id)
      .select()
      .maybeSingle();

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (result.data) {
      const next = customProfile(result.data as Profile);
      setData({ ...data, profile: result.data as Profile });
      setForm(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  const publicUrl = `${window.location.origin}/agendar/${form.slug}`;

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Personalize seu espaço</div>
          <h1>Meu perfil</h1>
          <p>
            Monte sua página do seu jeito. Logo, foto, identidade e informações aparecem para suas clientes.
          </p>
        </div>

        {saved && (
          <span className="saved">
            <Check size={16} />
            Salvo
          </span>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="profile-settings-grid">
        <form className="form-card" onSubmit={save}>
          <div className="profile-form-heading">
            <Avatar profile={form} size="large" />
            <div>
              <h2>Identidade</h2>
              <p>Escolha como seu negócio será apresentado.</p>
            </div>
          </div>

          <div className="form-row">
            <div className="media-field">
              <span>Foto de perfil</span>
              <div className="media-upload">
                <Avatar profile={form} size="large" />
                <label className="button button-soft">
                  <Upload size={16} />
                  {uploading === 'avatar' ? 'Enviando...' : 'Trocar foto'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={!!uploading}
                    onChange={(event) => uploadImage(event, 'avatar')}
                  />
                </label>
              </div>
            </div>

            <div className="media-field">
              <span>Logo</span>
              <div className="media-upload">
                <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', border: '1px solid rgba(0,0,0,.08)', borderRadius: 14, overflow: 'hidden' }}>
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ImageIcon size={22} />
                  )}
                </div>
                <label className="button button-soft">
                  <Upload size={16} />
                  {uploading === 'logo' ? 'Enviando...' : 'Enviar logo'}
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    disabled={!!uploading}
                    onChange={(event) => uploadImage(event, 'logo')}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="form-row">
            <Field
              label="Nome do negócio"
              placeholder="Como suas clientes te conhecem?"
              value={form.business_name}
              onChange={(event) => setForm({ ...form, business_name: event.target.value })}
            />
            <Field
              label="Seu nome"
              placeholder="Seu nome completo"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <Field
            label="Especialidade"
            placeholder="Ex.: Designer de sobrancelhas"
            value={form.specialty}
            onChange={(event) => setForm({ ...form, specialty: event.target.value })}
          />

          <label className="field">
            <span>Descrição</span>
            <textarea
              rows={4}
              placeholder="Conte brevemente sobre seu trabalho..."
              value={form.description || ''}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          <div className="form-row">
            <Field
              label="WhatsApp"
              placeholder="(00) 00000-0000"
              value={form.whatsapp}
              onChange={(event) => setForm({ ...form, whatsapp: event.target.value })}
            />
            <Field
              label="Telefone"
              placeholder="(00) 0000-0000"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
          </div>

          <Field
            label="Chave Pix"
            placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
            value={form.pix_key || ''}
            onChange={(event) => setForm({ ...form, pix_key: event.target.value })}
          />

          <Field
            label="Endereço"
            placeholder="Rua, número"
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />

          <div className="form-row">
            <Field
              label="Cidade"
              placeholder="Sua cidade"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
            <Field
              label="Estado"
              placeholder="UF"
              maxLength={2}
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })}
            />
          </div>

          <label className="field">
            <span><Palette size={15} /> Cor principal</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={form.primary_color || '#111111'}
                onChange={(event) => setForm({ ...form, primary_color: event.target.value })}
                style={{ width: 52, height: 42, padding: 3 }}
              />
              <input
                value={form.primary_color || '#111111'}
                onChange={(event) => setForm({ ...form, primary_color: event.target.value })}
                placeholder="#111111"
              />
            </div>
          </label>

          <Button type="submit">Salvar alterações</Button>
        </form>

        <aside className="link-card">
          <div className="link-card-icon"><Link2 size={20} /></div>
          <div className="eyebrow">Seu link de agendamento</div>
          <h2>Pronto para compartilhar</h2>
          <p>Coloque na bio do Instagram e deixe suas clientes marcarem sozinhas.</p>
          <div className="copy-field">
            <span>{publicUrl}</span>
            <button type="button" onClick={() => navigator.clipboard.writeText(publicUrl)}>
              <Copy size={16} />
            </button>
          </div>
          <a className="text-link" href={publicUrl} target="_blank" rel="noreferrer">
            Abrir página pública <ExternalLink size={15} />
          </a>
        </aside>
      </div>
    </>
  );
}


function DesignSystem() {
  return (
    <style>{`
      :root {
        --ui-ink: #111214;
        --ui-ink-2: #2d3035;
        --ui-muted: #70757c;
        --ui-soft: #f4f5f6;
        --ui-soft-2: #eceef0;
        --ui-line: rgba(17,18,20,.085);
        --ui-line-strong: rgba(17,18,20,.14);
        --ui-white: rgba(255,255,255,.86);
        --ui-shadow-sm: 0 8px 24px rgba(17,18,20,.055);
        --ui-shadow: 0 18px 50px rgba(17,18,20,.085);
        --ui-radius: 16px;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; color-scheme: dark; background:#111315; }
      body {
        margin: 0;
        background: #111315;
        color: #f4f5f6;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      button, input, textarea { font: inherit; }
      button, a { -webkit-tap-highlight-color: transparent; }
      a { color: inherit; }

      @keyframes ui-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ui-soft-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ui-shine { from { transform: translateX(-140%) skewX(-18deg); } to { transform: translateX(170%) skewX(-18deg); } }
      @keyframes ui-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
      @keyframes ui-spin { to { transform: rotate(360deg); } }

      .spin { animation: ui-spin .8s linear infinite; }
      .brand { display:inline-flex; align-items:center; gap:9px; text-decoration:none; font-size:15px; font-weight:850; letter-spacing:-.045em; }
      .brand-mark { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:#111214; color:#fff; box-shadow:0 6px 16px rgba(17,18,20,.15); }
      .brand-dot { color:#999da3; }
      .eyebrow { display:inline-flex; align-items:center; gap:6px; color:#777c83; font-size:9px; line-height:1; font-weight:800; letter-spacing:.11em; text-transform:uppercase; }
      .eyebrow::before { content:""; width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.55; }
      .muted { color:#7b8087; font-size:12px; line-height:1.55; }

      .button { position:relative; display:inline-flex; align-items:center; justify-content:center; gap:8px; min-height:42px; padding:0 15px; border:1px solid transparent; border-radius:11px; font-size:12px; font-weight:750; letter-spacing:-.01em; cursor:pointer; text-decoration:none; overflow:hidden; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease; }
      .button::after { content:""; position:absolute; inset:0 auto 0 -45%; width:22%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent); transform:skewX(-18deg); pointer-events:none; }
      .button:hover::after { animation:ui-shine .7s ease; }
      .button:hover { transform:translateY(-1px); }
      .button:active { transform:scale(.985); }
      .button:disabled { opacity:.5; cursor:not-allowed; transform:none; }
      .button-primary, .button-dark { color:#fff; background:#111214; box-shadow:0 9px 22px rgba(17,18,20,.14); }
      .button-primary:hover, .button-dark:hover { box-shadow:0 12px 27px rgba(17,18,20,.19); }
      .button-soft { color:#22252a; background:#fff; border-color:var(--ui-line-strong); box-shadow:var(--ui-shadow-sm); }
      .button-ghost { color:#666b72; background:transparent; }
      .button-danger { color:#9a2929; background:#fff5f5; border-color:rgba(154,41,41,.12); }
      .icon-button { width:36px; height:36px; padding:0; display:grid; place-items:center; border:1px solid var(--ui-line); border-radius:10px; background:rgba(255,255,255,.82); color:#25282d; cursor:pointer; transition:transform .18s ease, background .18s ease, box-shadow .18s ease; }
      .icon-button:hover { transform:translateY(-1px); background:#fff; box-shadow:var(--ui-shadow-sm); }
      .icon-button:active { transform:scale(.96); }

      .field { display:grid; gap:6px; }
      .field > span { font-size:10px; font-weight:750; color:#4e535a; }
      .field input, .field textarea { width:100%; border:1px solid var(--ui-line-strong) !important; border-radius:10px !important; background:#fff !important; color:var(--ui-ink) !important; box-shadow:inset 0 1px 0 rgba(255,255,255,.95) !important; transition:border-color .18s ease, box-shadow .18s ease; }
      .field input { min-height:42px; }
      .field textarea { min-height:100px; resize:vertical; }
      .field input:focus, .field textarea:focus { outline:none; border-color:rgba(17,18,20,.35) !important; box-shadow:0 0 0 3px rgba(17,18,20,.055) !important; }
      .form-error, .saved { padding:10px 11px; border-radius:10px; font-size:11px; line-height:1.45; }
      .form-error { color:#8f2525; background:#fff3f3; border:1px solid rgba(143,37,37,.1); }
      .saved { color:#27633d; background:#f1faf4; border:1px solid rgba(39,99,61,.1); }

      .center-page { min-height:100vh; display:grid; place-items:center; align-content:center; gap:10px; padding:24px; background:radial-gradient(circle at 50% 15%,#fff,transparent 36%),#f5f5f4; }
      .center-page > * { position:relative; z-index:1; }
      .panel { border:1px solid var(--ui-line); border-radius:18px; background:rgba(255,255,255,.88); box-shadow:var(--ui-shadow); backdrop-filter:blur(18px); }
      .panel.centered { width:min(500px,100%); padding:28px; text-align:center; }
      .panel.centered h1 { margin:9px 0 8px; font-size:28px; letter-spacing:-.055em; }
      .panel.centered p { margin:0 0 18px; color:#72777e; font-size:12px; line-height:1.55; }

      /* HOME */
      .home-copy { width:min(760px,100%); margin:auto 0; padding:8vh 0 9vh; animation:ui-in .6s ease both; }
      .home-copy h1 { max-width:700px; margin:15px 0 13px; font-size:clamp(42px,6.5vw,78px); line-height:.96; letter-spacing:-.075em; }
      .home-copy p { max-width:540px; margin:0; color:#656a71; font-size:15px; line-height:1.6; }
      .home-actions { display:flex; gap:9px; align-items:center; flex-wrap:wrap; margin-top:23px; }

      /* AUTH */
      .auth-page { min-height:100vh; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(390px,.95fr); background:#f5f5f4; }
      .auth-aside { position:relative; min-height:100vh; display:flex; flex-direction:column; justify-content:space-between; padding:28px clamp(26px,5vw,64px); overflow:hidden; border-right:1px solid var(--ui-line); background:radial-gradient(circle at 72% 30%,#e7e9eb,transparent 25%),linear-gradient(145deg,#fff,#f0f1f2); }
      .auth-aside::after { content:""; position:absolute; width:500px; height:500px; right:-260px; bottom:-210px; border:1px solid rgba(17,18,20,.07); border-radius:50%; box-shadow:0 0 0 55px rgba(17,18,20,.012); }
      .auth-aside > * { position:relative; z-index:1; }
      .auth-aside > div:nth-child(2) { max-width:610px; animation:ui-in .65s .05s ease both; }
      .auth-aside h1 { max-width:600px; margin:16px 0 14px; font-size:clamp(42px,5.5vw,70px); line-height:.97; letter-spacing:-.07em; }
      .auth-aside p { max-width:500px; margin:0; color:#676c73; font-size:14px; line-height:1.6; }
      .aside-note { color:#858a91; font-size:10px; }
      .auth-card { width:min(430px,calc(100% - 40px)); align-self:center; margin:20px auto; padding:30px; border:1px solid var(--ui-line); border-radius:18px; background:rgba(255,255,255,.9); box-shadow:var(--ui-shadow); backdrop-filter:blur(20px); animation:ui-in .65s .1s ease both; }
      .mobile-brand { display:none; margin-bottom:22px; }
      .auth-card h2 { margin:13px 0 6px; font-size:30px; letter-spacing:-.06em; }
      .auth-lead { margin:0 0 20px; color:#747980; font-size:12px; line-height:1.5; }
      .auth-card form { display:grid; gap:12px; }
      .auth-card form .button { width:100%; margin-top:2px; }
      .switch-auth { margin:17px 0 0; text-align:center; color:#7b8087; font-size:11px; }
      .switch-auth button { margin-left:4px; border:0; background:none; color:#111214; font-weight:800; cursor:pointer; }

      /* PUBLIC */
      .public-shell { min-height:100vh; position:relative; overflow:hidden; background:radial-gradient(circle at 78% 8%,color-mix(in srgb,var(--profile-primary,#111) 6%,white),transparent 26%),#fafaf9; }
      .public-shell::before { content:""; position:absolute; width:540px; height:540px; right:-260px; top:100px; border:1px solid rgba(17,18,20,.05); border-radius:50%; pointer-events:none; }
      .public-nav { position:sticky; top:10px; z-index:40; width:min(1080px,calc(100% - 28px)); min-height:56px; margin:10px auto 0; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:7px 8px 7px 13px; border:1px solid var(--ui-line); border-radius:14px; background:rgba(255,255,255,.78); box-shadow:var(--ui-shadow-sm); backdrop-filter:blur(18px); }
      .public-links { display:flex; align-items:center; gap:2px; }
      .public-links a { padding:8px 10px; border-radius:8px; color:#686d74; text-decoration:none; font-size:10px; font-weight:750; transition:background .18s ease,color .18s ease; }
      .public-links a:hover { color:#111214; background:rgba(17,18,20,.045); }
      .menu-button { display:none; }
      .profile-hero { width:min(1080px,calc(100% - 28px)); min-height:570px; margin:0 auto; display:grid; grid-template-columns:minmax(250px,.8fr) minmax(0,1.2fr); align-items:center; gap:clamp(28px,5vw,70px); padding:55px 0 60px; }
      .profile-image { position:relative; min-height:350px; display:grid; place-items:center; }
      .profile-image::before { content:""; position:absolute; width:min(330px,80vw); aspect-ratio:1; border-radius:44% 56% 50% 50%; background:linear-gradient(145deg,#fff,#e9ebed); border:1px solid var(--ui-line); box-shadow:20px 25px 55px rgba(17,18,20,.08); transform:rotate(-6deg); }
      .profile-image::after { content:""; position:absolute; width:65%; aspect-ratio:1; border:1px solid rgba(17,18,20,.055); border-radius:50%; }
      .profile-image .avatar { position:relative; z-index:2; border:6px solid rgba(255,255,255,.9); box-shadow:0 20px 50px rgba(17,18,20,.14); }
      .profile-content { max-width:650px; animation:ui-in .6s .08s ease both; }
      .profile-content h1 { max-width:680px; margin:13px 0 6px; font-size:clamp(46px,6.5vw,82px); line-height:.93; letter-spacing:-.075em; }
      .profile-specialty { margin:0; color:#4e535a; font-size:14px; font-weight:750; }
      .profile-description { max-width:570px; margin:15px 0 0; color:#73787f; font-size:13px; line-height:1.6; }
      .profile-facts { display:flex; flex-wrap:wrap; gap:6px; margin:18px 0 21px; }
      .profile-facts span { display:inline-flex; align-items:center; gap:6px; padding:7px 9px; border:1px solid var(--ui-line); border-radius:999px; background:rgba(255,255,255,.7); color:#696e75; font-size:9px; }
      .profile-content .button { min-width:145px; }
      .public-section, .location-section, .contact-strip, .public-shell footer { width:min(1080px,calc(100% - 28px)); margin-left:auto; margin-right:auto; position:relative; z-index:1; }
      .public-section { padding:48px 0 62px; }
      .section-heading { display:flex; align-items:end; justify-content:space-between; gap:16px; margin-bottom:18px; }
      .section-heading h2, .contact-strip h2, .location-section h2 { margin:7px 0 0; font-size:clamp(28px,3.5vw,42px); line-height:1; letter-spacing:-.06em; }
      .section-heading > span { color:#8a8f95; font-size:10px; font-weight:700; }
      .service-list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
      .service-card { position:relative; min-height:148px; display:flex; align-items:flex-end; justify-content:space-between; gap:18px; padding:19px; border:1px solid var(--ui-line); border-radius:15px; background:rgba(255,255,255,.78); text-align:left; cursor:pointer; overflow:hidden; box-shadow:0 7px 24px rgba(17,18,20,.035); transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease; }
      .service-card::before { content:""; position:absolute; width:130px; height:130px; right:-60px; top:-65px; border-radius:50%; background:color-mix(in srgb,var(--profile-primary,#111) 7%,white); filter:blur(2px); }
      .service-card:hover { transform:translateY(-3px); border-color:rgba(17,18,20,.14); box-shadow:0 16px 36px rgba(17,18,20,.07); }
      .service-card h3 { position:relative; z-index:1; margin:0 0 6px; font-size:16px; letter-spacing:-.035em; }
      .service-card p { position:relative; z-index:1; max-width:360px; margin:0 0 11px; color:#777c83; font-size:10px; line-height:1.5; }
      .service-card strong { position:relative; z-index:1; white-space:nowrap; font-size:15px; }
      .service-duration { position:relative; z-index:1; display:inline-flex; align-items:center; gap:5px; color:#858a91; font-size:9px; font-weight:700; }
      .contact-strip { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:4px; padding:22px 24px; border:1px solid var(--ui-line); border-radius:17px; background:linear-gradient(135deg,#fff,#f1f2f3); box-shadow:var(--ui-shadow-sm); }
      .contact-strip p, .location-section p { margin:7px 0 0; color:#777c83; font-size:11px; line-height:1.5; }
      .location-section { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:58px 0 68px; }
      .location-section > div { max-width:620px; }
      .text-link { display:inline-flex; align-items:center; gap:5px; color:#5f646b; font-size:10px; font-weight:750; text-decoration:none; transition:transform .18s ease,color .18s ease; }
      .text-link:hover { color:#111214; transform:translateX(2px); }
      .public-shell footer { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 0 24px; border-top:1px solid var(--ui-line); color:#888d94; font-size:9px; }
      .public-shell footer a { display:inline-flex; align-items:center; gap:4px; color:#5d6269; font-weight:750; text-decoration:none; }

      /* BOOKING */
      .booking-overlay { position:fixed !important; inset:0 !important; z-index:100 !important; display:flex !important; align-items:flex-end !important; justify-content:center !important; padding:14px !important; background:rgba(17,18,20,.24) !important; backdrop-filter:blur(10px); animation:ui-soft-in .18s ease both; }
      .booking-panel { width:min(650px,100%); max-height:calc(100vh - 28px); overflow:auto; border:1px solid rgba(255,255,255,.78) !important; border-radius:20px !important; background:rgba(255,255,255,.96) !important; box-shadow:0 28px 80px rgba(17,18,20,.2) !important; backdrop-filter:blur(22px); animation:ui-in .24s cubic-bezier(.2,.8,.2,1) both; }
      .booking-top { position:sticky; top:0; z-index:3; min-height:58px; display:grid !important; grid-template-columns:36px 1fr auto; align-items:center; gap:10px; padding:10px 13px !important; border-bottom:1px solid var(--ui-line) !important; background:rgba(255,255,255,.88) !important; backdrop-filter:blur(16px); }
      .booking-top > div:nth-child(2) span { display:block; font-size:12px; font-weight:800; letter-spacing:-.02em; }
      .booking-top > div:nth-child(2) small { display:block; margin-top:2px; color:#888d94; font-size:9px; }
      .step-dots { display:flex; gap:4px; }
      .step-dots i { width:18px; height:3px; border-radius:99px; background:#e2e4e7; transition:width .2s ease,background .2s ease; }
      .step-dots i.active { width:25px; background:var(--profile-primary,#111214); }
      .booking-content { padding:21px !important; }
      .booking-heading h2 { margin:8px 0 5px; font-size:27px; line-height:1; letter-spacing:-.06em; }
      .booking-heading p { margin:0; color:#7a7f86; font-size:11px; line-height:1.5; }
      .selected-service, .summary-mini { border:1px solid var(--ui-line); border-radius:13px; background:linear-gradient(135deg,#fff,#f5f6f7); box-shadow:0 7px 22px rgba(17,18,20,.035); }
      .selected-service { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px; margin:15px 0; }
      .selected-service strong { display:block; font-size:12px; }
      .selected-service span { display:block; margin-top:3px; color:#858a91; font-size:9px; }
      .selected-service button, .back-link { border:0; background:none; color:#5e636a; font-size:10px; font-weight:800; cursor:pointer; }
      .date-grid { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; margin:17px 0 18px; }
      .date-grid button { min-height:67px; display:grid; place-items:center; align-content:center; gap:2px; padding:5px 3px; border:1px solid var(--ui-line); border-radius:10px; background:#fff; color:#7b8087; cursor:pointer; transition:transform .16s ease,border-color .16s ease,background .16s ease,box-shadow .16s ease; }
      .date-grid button:hover { transform:translateY(-1px); box-shadow:var(--ui-shadow-sm); }
      .date-grid button.selected { color:#fff; border-color:var(--profile-primary,#111); background:var(--profile-primary,#111); box-shadow:0 8px 20px color-mix(in srgb,var(--profile-primary,#111) 18%,transparent); }
      .date-grid button small { font-size:8px; text-transform:capitalize; }
      .date-grid button strong { font-size:18px; letter-spacing:-.06em; }
      .date-grid button span { font-size:8px; }
      .slot-area { margin:0 0 17px; padding:14px; border:1px solid var(--ui-line); border-radius:13px; background:#fafafa; }
      .slot-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin-top:9px; }
      .slot-grid button { min-height:40px; border:1px solid var(--ui-line-strong); border-radius:9px; background:#fff; color:#33373c; font-size:11px; font-weight:750; cursor:pointer; transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease; }
      .slot-grid button:hover { transform:translateY(-1px); box-shadow:0 7px 16px rgba(17,18,20,.06); }
      .slot-grid button.selected { color:#fff; border-color:var(--profile-primary,#111); background:var(--profile-primary,#111); }
      .back-link { display:inline-flex; align-items:center; gap:2px; padding:0; margin-bottom:11px; }
      .summary-mini { display:grid; gap:3px; margin:15px 0; padding:13px; }
      .summary-mini span { color:#898e95; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
      .summary-mini strong { font-size:12px; }
      .summary-mini p { margin:0; color:#757a81; font-size:10px; }
      .summary-mini b { margin-top:3px; font-size:12px; }
      .confirmation { width:min(600px,calc(100% - 28px)); min-height:calc(100vh - 75px); margin:0 auto; display:grid; place-items:center; align-content:center; text-align:center; padding:55px 0; animation:ui-in .5s ease both; }
      .success-mark { width:62px; height:62px; display:grid; place-items:center; margin-bottom:17px; border-radius:19px; color:#fff; background:#111214; box-shadow:0 16px 35px rgba(17,18,20,.16); }
      .confirmation h1 { margin:10px 0 7px; font-size:clamp(36px,5vw,58px); line-height:.95; letter-spacing:-.07em; }
      .confirmation > p { margin:0; color:#747980; font-size:12px; line-height:1.55; }
      .booking-receipt { width:min(470px,100%); margin:22px 0 17px; display:grid; grid-template-columns:repeat(3,1fr); gap:1px; overflow:hidden; border:1px solid var(--ui-line); border-radius:14px; background:var(--ui-line); box-shadow:var(--ui-shadow-sm); }
      .booking-receipt > div { padding:13px 10px; background:rgba(255,255,255,.92); }
      .booking-receipt span { display:block; margin-bottom:4px; color:#898e95; font-size:8px; font-weight:800; text-transform:uppercase; }
      .booking-receipt strong { font-size:10px; }

      /* DASHBOARD */
      .dashboard-shell { min-height:100vh; display:grid; grid-template-columns:220px minmax(0,1fr); background:#f5f5f4; }
      .sidebar { position:relative; z-index:20; min-height:100vh; display:flex; flex-direction:column; padding:16px 11px; border-right:1px solid var(--ui-line); background:rgba(255,255,255,.76); backdrop-filter:blur(18px); }
      .sidebar-top { display:flex; align-items:center; justify-content:space-between; padding:0 5px 17px; }
      .sidebar-top .icon-button { display:none; }
      .side-profile { display:flex; align-items:center; gap:9px; padding:10px 8px; margin-bottom:11px; border:1px solid var(--ui-line); border-radius:12px; background:rgba(255,255,255,.72); }
      .side-profile strong { display:block; max-width:125px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; }
      .side-profile span { display:block; max-width:125px; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#898e95; font-size:8px; }
      .sidebar nav { display:grid; gap:2px; }
      .sidebar nav a { position:relative; display:flex; align-items:center; gap:9px; padding:9px 9px; border-radius:9px; color:#747980; text-decoration:none; font-size:10px; font-weight:700; transition:background .16s ease,color .16s ease,transform .16s ease; }
      .sidebar nav a:hover { color:#111214; background:rgba(17,18,20,.04); transform:translateX(1px); }
      .sidebar nav a.active { color:#111214; background:rgba(17,18,20,.065); }
      .sidebar nav a.active::before { content:""; position:absolute; left:-11px; width:2px; height:18px; border-radius:0 4px 4px 0; background:#111214; }
      .logout { margin-top:auto; display:flex; align-items:center; gap:9px; padding:9px; border:0; border-radius:9px; background:transparent; color:#858a91; font-size:10px; font-weight:700; cursor:pointer; }
      .logout:hover { color:#9a2929; background:#fff5f5; }
      .dashboard-main { min-width:0; }
      .dashboard-top { position:sticky; top:0; z-index:15; min-height:62px; display:flex; align-items:center; gap:10px; padding:9px clamp(15px,2.5vw,28px); border-bottom:1px solid var(--ui-line); background:rgba(245,245,244,.82); backdrop-filter:blur(16px); }
      .dashboard-top > div:nth-child(2) { display:grid; gap:2px; }
      .top-kicker { color:#8b9096; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; }
      .dashboard-top strong { font-size:11px; letter-spacing:-.02em; }
      .public-link { margin-left:auto; display:inline-flex; align-items:center; gap:6px; padding:8px 10px; border:1px solid var(--ui-line); border-radius:9px; background:#fff; color:#62676e; text-decoration:none; font-size:9px; font-weight:750; }
      .mobile-only { display:none; }
      .dashboard-content { width:min(1040px,calc(100% - 40px)); margin:0 auto; padding:28px 0 55px; animation:ui-in .4s ease both; }
      .page-title { display:flex; align-items:flex-end; justify-content:space-between; gap:18px; margin-bottom:20px; }
      .page-title h1 { margin:7px 0 5px; font-size:34px; line-height:.98; letter-spacing:-.065em; }
      .page-title p { margin:0; color:#7b8087; font-size:11px; line-height:1.5; }
      .dashboard-section, .form-card, .hours-card, .link-card { border:1px solid var(--ui-line); border-radius:15px; background:rgba(255,255,255,.82); box-shadow:0 7px 25px rgba(17,18,20,.035); }
      .dashboard-section { padding:17px; }
      .form-card { display:grid; gap:12px; padding:17px; }
      .form-card h2 { margin:0; font-size:15px; letter-spacing:-.035em; }
      .section-heading { margin-bottom:13px; }
      .section-heading h2 { font-size:15px; }
      .overview-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; margin-bottom:18px; }
      .metric-card { position:relative; min-height:108px; padding:15px; overflow:hidden; border:1px solid var(--ui-line); border-radius:14px; background:#fff; box-shadow:0 7px 24px rgba(17,18,20,.035); }
      .metric-card::after { content:""; position:absolute; width:95px; height:95px; right:-45px; top:-50px; border-radius:50%; background:#f1f2f3; }
      .metric-card > span { position:relative; z-index:1; display:block; color:#858a91; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.09em; }
      .metric-card strong { position:relative; z-index:1; display:block; margin-top:9px; font-size:28px; letter-spacing:-.07em; }
      .metric-card p { position:relative; z-index:1; margin:3px 0 0; color:#858a91; font-size:9px; }
      .quick-actions { display:flex; flex-wrap:wrap; gap:7px; margin-top:15px; }
      .appointment-list, .service-admin-list, .block-list { display:grid; gap:7px; }
      .appointment-card, .service-admin, .block-row, .hour-row { border:1px solid var(--ui-line); border-radius:12px; background:#fff; }
      .appointment-card { display:grid; grid-template-columns:70px 1fr auto; gap:11px; align-items:center; padding:11px; transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease; }
      .appointment-card:hover, .service-admin:hover, .block-row:hover, .hour-row:hover { transform:translateY(-1px); border-color:rgba(17,18,20,.13); box-shadow:0 9px 22px rgba(17,18,20,.05); }
      .appointment-time strong { display:block; font-size:16px; letter-spacing:-.05em; }
      .appointment-time span, .appointment-info span { display:block; color:#858a91; font-size:8px; margin-top:2px; }
      .appointment-info strong { display:block; font-size:10px; }
      .appointment-price { text-align:right; font-size:10px; font-weight:800; }
      .cancel-link { display:block; margin-top:4px; border:0; background:none; color:#9a2929; font-size:8px; cursor:pointer; }
      .tabs { display:flex; gap:3px; margin-bottom:12px; padding:3px; width:max-content; border:1px solid var(--ui-line); border-radius:10px; background:#f5f6f7; }
      .tabs button { padding:7px 10px; border:0; border-radius:7px; background:transparent; color:#7a7f86; font-size:9px; font-weight:750; cursor:pointer; }
      .tabs button.active { color:#111214; background:#fff; box-shadow:0 3px 9px rgba(17,18,20,.06); }
      .two-column { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(300px,.7fr); gap:10px; align-items:start; }
      .service-admin { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 12px; }
      .service-admin h3 { margin:0; font-size:11px; }
      .service-admin p { margin:3px 0 0; color:#858a91; font-size:8px; }
      .service-admin > div:last-child { display:flex; align-items:center; gap:8px; }
      .small-action { width:29px; height:29px; display:grid; place-items:center; padding:0; border:1px solid var(--ui-line); border-radius:8px; background:#fff; color:#62676e; cursor:pointer; }
      .small-action.danger { color:#9a2929; }
      .form-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .profile-settings-grid { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr); gap:10px; align-items:start; }
      .profile-form-heading { margin-bottom:2px; }
      .profile-form-heading h2 { margin:5px 0 0; font-size:16px; letter-spacing:-.04em; }
      .media-upload { display:flex; align-items:center; gap:10px; }
      .media-field { display:grid; gap:7px; }
      .media-field > span { font-size:10px; font-weight:750; color:#4e535a; }
      .link-card { padding:17px; }
      .link-card-icon { width:32px; height:32px; display:grid; place-items:center; margin-bottom:13px; border-radius:9px; background:#f1f2f3; }
      .link-card .eyebrow { display:flex; }
      .link-card > strong { display:block; margin:7px 0 12px; font-size:14px; }
      .copy-field { display:flex; align-items:center; gap:7px; padding:7px; border:1px solid var(--ui-line-strong); border-radius:9px; background:#fff; }
      .copy-field input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:#666b72; font-size:9px; }
      .copy-field button { width:28px; height:28px; display:grid; place-items:center; border:0; border-radius:7px; background:#f2f3f4; cursor:pointer; }
      .hours-card { overflow:hidden; }
      .hours-row { display:grid; grid-template-columns:130px 1fr; gap:13px; padding:13px 15px; border-width:0 0 1px; border-radius:0; }
      .hours-row:last-child { border-bottom:0; }
      .day-toggle { display:flex; align-items:center; gap:8px; }
      .day-toggle strong { font-size:10px; }
      .time-inputs { display:flex; align-items:center; gap:7px; }
      .time-inputs input, .hours-row input[type="time"] { min-height:36px; padding:0 8px; border:1px solid var(--ui-line-strong); border-radius:8px; background:#fff; color:#111214; font-size:10px; }
      .time-inputs span { color:#8a8f95; font-size:9px; }
      .closed { color:#999da3; font-size:9px; }
      .hours-row > div[style] { grid-column:1 / -1 !important; margin-top:2px !important; padding-left:0 !important; }
      .hours-row > div[style] > div { padding-top:10px !important; border-top:1px solid var(--ui-line) !important; }
      .hours-row > div[style] strong { font-size:11px !important; }
      .hours-row > div[style] p { margin:3px 0 9px !important; font-size:9px !important; color:#858a91 !important; }
      .hours-row > div[style] > div > div { gap:6px !important; }
      .block-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 12px; }
      .block-row > div { display:flex; align-items:center; gap:9px; }
      .block-row strong { display:block; font-size:10px; }
      .block-row span { color:#858a91; font-size:8px; }
      .empty { display:grid; place-items:center; padding:32px 18px; text-align:center; border:1px dashed rgba(17,18,20,.13); border-radius:13px; background:rgba(255,255,255,.5); }
      .empty-icon { width:34px; height:34px; display:grid; place-items:center; margin-bottom:8px; border-radius:10px; background:#f0f1f2; }
      .empty h3 { margin:0 0 4px; font-size:12px; }
      .empty p { max-width:330px; margin:0; color:#858a91; font-size:9px; line-height:1.5; }
      .saved { animation:ui-soft-in .25s ease both; }

      @media (max-width: 900px) {
        .auth-page { grid-template-columns:1fr; }
        .auth-aside { min-height:300px; padding:24px; }
        .auth-aside h1 { font-size:clamp(38px,10vw,58px); }
        .auth-aside p, .aside-note { display:none; }
        .auth-card { margin:-45px auto 24px; }
        .mobile-brand { display:block; }
        .profile-hero { grid-template-columns:1fr; min-height:auto; gap:22px; padding:48px 0 48px; text-align:center; }
        .profile-image { min-height:250px; }
        .profile-image::before { width:250px; }
        .profile-content { margin:0 auto; }
        .profile-content h1 { font-size:clamp(44px,12vw,64px); }
        .profile-facts { justify-content:center; }
        .service-list { grid-template-columns:1fr; }
        .dashboard-shell { grid-template-columns:1fr; }
        .sidebar { position:fixed; inset:0 auto 0 0; width:min(270px,84vw); transform:translateX(-105%); transition:transform .25s cubic-bezier(.2,.8,.2,1); box-shadow:24px 0 60px rgba(17,18,20,.14); }
        .sidebar.open { transform:translateX(0); }
        .sidebar-top .icon-button { display:grid; }
        .mobile-only { display:grid; }
      }

      @media (max-width: 640px) {
        .home-copy { padding:7vh 0 8vh; }
        .home-copy h1 { font-size:clamp(40px,13vw,58px); }
        .home-actions { flex-direction:column; align-items:stretch; }
        .home-actions .button { width:100%; }
        .auth-aside { min-height:255px; }
        .auth-card { width:calc(100% - 24px); padding:23px 18px; margin-top:-38px; border-radius:16px; }
        .auth-card h2 { font-size:27px; }
        .public-nav { width:calc(100% - 16px); margin-top:8px; }
        .public-links { position:absolute; top:62px; left:0; right:0; display:grid; gap:2px; padding:6px; border:1px solid var(--ui-line); border-radius:12px; background:rgba(255,255,255,.95); box-shadow:var(--ui-shadow); opacity:0; pointer-events:none; transform:translateY(-5px); transition:opacity .18s ease,transform .18s ease; }
        .public-links.open { opacity:1; pointer-events:auto; transform:translateY(0); }
        .menu-button { display:grid; }
        .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width:calc(100% - 16px); }
        .profile-hero { padding-top:40px; padding-bottom:38px; }
        .profile-image { min-height:220px; }
        .profile-image::before { width:215px; }
        .profile-content h1 { font-size:clamp(40px,13vw,58px); }
        .profile-facts { align-items:center; flex-direction:column; margin-top:15px; }
        .public-section { padding:38px 0 46px; }
        .section-heading { align-items:flex-start; flex-direction:column; gap:6px; margin-bottom:13px; }
        .service-card { min-height:132px; padding:15px; }
        .contact-strip, .location-section { align-items:flex-start; flex-direction:column; padding:19px; }
        .location-section { padding:45px 0 52px; border-top:1px solid var(--ui-line); }
        .public-shell footer { align-items:flex-start; flex-direction:column; }
        .booking-overlay { padding:7px !important; }
        .booking-panel { max-height:calc(100vh - 14px); border-radius:17px !important; }
        .booking-content { padding:17px !important; }
        .booking-heading h2 { font-size:24px; }
        .date-grid { grid-template-columns:repeat(4,minmax(0,1fr)); }
        .slot-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .booking-receipt { grid-template-columns:1fr; }
        .booking-receipt > div { text-align:left; }
        .dashboard-top { padding:9px 12px; }
        .public-link { font-size:0; width:34px; padding:0; justify-content:center; }
        .dashboard-content { width:calc(100% - 24px); padding-top:21px; }
        .page-title { align-items:flex-start; flex-direction:column; gap:12px; margin-bottom:15px; }
        .page-title h1 { font-size:30px; }
        .overview-grid { grid-template-columns:1fr 1fr; }
        .overview-grid .metric-card:first-child { grid-column:1 / -1; }
        .two-column, .profile-settings-grid { grid-template-columns:1fr; }
        .form-row { grid-template-columns:1fr; }
        .appointment-card { grid-template-columns:60px 1fr auto; }
        .hours-row { grid-template-columns:1fr; gap:8px; }
        .time-inputs { justify-content:flex-start; }
        .hours-row > div[style] { grid-column:1 !important; }
      }


      /* FINAL LAYOUT / RESPONSIVE SYSTEM */
      .dashboard-shell { grid-template-columns:250px minmax(0,1fr); }
      .sidebar { padding:18px 14px; }
      .sidebar-top { padding:0 7px 11px; }
      .side-profile { gap:11px; padding:12px 10px; margin-bottom:9px; border-radius:8px; }
      .side-profile strong { max-width:170px; font-size:13px; }
      .side-profile span { max-width:170px; font-size:10px; }
      .sidebar nav { gap:1px; }
      .sidebar nav a { gap:11px; padding:11px; border-radius:7px; font-size:13px; }
      .sidebar nav a.active::before { left:-14px; height:22px; border-radius:0; }
      .logout { gap:11px; padding:11px; border-radius:7px; font-size:13px; }
      .sidebar nav a svg, .logout svg { width:18px; height:18px; }

      .dashboard-main { width:100%; min-width:0; }
      .dashboard-top { min-height:68px; gap:12px; padding:10px clamp(18px,2.5vw,32px); }
      .top-kicker { font-size:10px; }
      .dashboard-top strong { font-size:14px; }
      .public-link { gap:8px; padding:10px 12px; border-radius:7px; font-size:11px; }
      .dashboard-content { width:min(1180px,calc(100% - 48px)); margin:0 auto; padding:34px 0 60px; box-sizing:border-box; }
      .page-title { gap:24px; margin-bottom:24px; }
      .page-title h1 { font-size:40px; }
      .page-title p { font-size:13px; }
      .dashboard-section, .form-card, .hours-card, .link-card { border-radius:8px; }
      .dashboard-section { padding:21px; }
      .form-card { gap:14px; padding:21px; }
      .form-card h2, .section-heading h2 { font-size:18px; }
      .section-heading { margin-bottom:16px; }
      .overview-grid { gap:14px; margin-bottom:22px; }
      .metric-card { min-height:122px; padding:18px; border-radius:7px; }
      .metric-card strong { font-size:28px; }
      .metric-card span { font-size:11px; }
      .appointment-list, .service-admin-list, .block-list { gap:9px; }
      .appointment-card { grid-template-columns:82px minmax(0,1fr) auto; gap:13px; padding:15px; border-radius:7px; }
      .appointment-card strong { font-size:14px; }
      .appointment-card span { font-size:11px; }
      .service-admin, .block-row { padding:14px 15px; border-radius:7px; }
      .two-column, .profile-settings-grid { gap:16px; }
      .hours-row { grid-template-columns:155px minmax(0,1fr); gap:20px; padding:16px 18px; }
      .quick-actions { gap:9px; margin-top:18px; }
      .small-action { border-radius:6px; }
      .copy-field { border-radius:7px; }
      .copy-field button { border-radius:6px; }
      .tabs { border-radius:7px; }
      .tabs button { border-radius:5px; }

      /* Public page: preserve the desktop scale while using restrained corners. */
      .public-nav { width:min(1200px,calc(100% - 40px)); }
      .profile-hero { width:min(1200px,calc(100% - 40px)); min-height:600px; grid-template-columns:minmax(300px,.85fr) minmax(0,1.15fr); gap:clamp(40px,6vw,90px); padding:64px 0 72px; }
      .profile-image { min-height:390px; }
      .public-section, .location-section, .contact-strip, .public-shell footer { width:min(1200px,calc(100% - 40px)); }
      .public-section { padding:58px 0 72px; }
      .service-list { gap:14px; }
      .service-card { min-height:166px; padding:22px; gap:24px; border-radius:7px; }
      .contact-strip { margin-top:8px; padding:26px 28px; }
      .location-section { padding:68px 0 78px; }
      .booking-panel { width:min(720px,100%); }
      .booking-content { padding:26px !important; }
      .date-grid { gap:7px; margin:20px 0 21px; }
      .date-grid button { min-height:74px; border-radius:6px; }
      .slot-area { padding:17px; border-radius:8px; }
      .slot-grid { gap:8px; margin-top:11px; }
      .slot-grid button { min-height:44px; border-radius:6px; }

      @media (min-width:1400px) {
        .dashboard-content { width:min(1240px,calc(100% - 72px)); }
        .public-nav, .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width:min(1280px,calc(100% - 72px)); }
      }

      @media (max-width:1100px) {
        .dashboard-shell { grid-template-columns:228px minmax(0,1fr); }
        .dashboard-content { width:min(1040px,calc(100% - 36px)); }
        .sidebar nav a { font-size:12px; }
      }

      @media (max-width:900px) {
        html, body, #root { width:100%; min-width:0; overflow-x:hidden; }
        .dashboard-shell { display:block; width:100%; min-height:100vh; }
        .dashboard-main { width:100%; min-width:0; overflow-x:hidden; }
        .dashboard-top { width:100%; box-sizing:border-box; padding:10px 16px; }
        .dashboard-content { width:100%; max-width:none; margin:0; padding:24px 16px 44px; }
        .sidebar { position:fixed; inset:0 auto 0 0; width:min(270px,84vw); max-width:84vw; min-height:100vh; transform:translateX(-105%); overflow-x:hidden; overflow-y:auto; z-index:100; }
        .sidebar.open { transform:translateX(0); }
        .sidebar-top .icon-button { display:grid; }
        .mobile-only { display:grid; }
        .profile-hero { width:calc(100% - 32px); min-height:auto; grid-template-columns:1fr; gap:28px; padding:52px 0 58px; text-align:center; }
        .profile-image { min-height:300px; }
        .profile-content { width:100%; margin:0 auto; }
        .profile-facts { justify-content:center; }
        .public-section, .location-section, .contact-strip, .public-shell footer { width:calc(100% - 32px); }
        .service-list { grid-template-columns:1fr; }
        .two-column, .profile-settings-grid { grid-template-columns:1fr; }
        .form-row { grid-template-columns:1fr; }
      }

      @media (max-width:640px) {
        .dashboard-top { min-height:60px; padding:8px 12px; gap:9px; }
        .dashboard-top > div:nth-child(2) { min-width:0; overflow:hidden; }
        .dashboard-top strong { display:block; max-width:calc(100vw - 100px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; }
        .public-link { width:36px; min-width:36px; height:36px; padding:0; justify-content:center; font-size:0; border-radius:50%; }
        .dashboard-content { width:100%; padding:18px 12px 36px; }
        .page-title { width:100%; align-items:flex-start; flex-direction:column; gap:8px; margin-bottom:16px; }
        .page-title h1 { font-size:32px; line-height:1.04; }
        .page-title p { font-size:12px; }
        .page-title > .button, .page-title > a.button { width:100%; }
        .overview-grid { grid-template-columns:1fr 1fr; gap:8px; margin-bottom:14px; }
        .overview-grid .metric-card:first-child { grid-column:1 / -1; }
        .metric-card { min-height:96px; padding:13px; }
        .metric-card strong { font-size:25px; }
        .dashboard-section, .form-card, .hours-card, .link-card { width:100%; padding:14px; border-radius:8px; }
        .section-heading { gap:8px; }
        .appointment-card { width:100%; grid-template-columns:58px minmax(0,1fr); gap:9px; padding:11px; }
        .appointment-time strong { font-size:16px; }
        .appointment-info { min-width:0; overflow:hidden; }
        .appointment-info strong, .appointment-info span, .appointment-info a { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .appointment-actions { grid-column:2; justify-content:flex-start; margin-top:2px; }
        .appointment-price { grid-column:2; text-align:left; margin-top:2px; }
        .service-admin, .block-row { width:100%; padding:11px 12px; }
        .service-admin > div:last-child, .block-row > div:last-child { flex-shrink:0; }
        .hours-row { grid-template-columns:1fr; gap:10px; padding:12px; }
        .time-inputs { width:100%; justify-content:flex-start; }
        .time-inputs input, .hours-row input[type='time'] { min-width:0; flex:1; }
        .profile-form-heading { display:flex; align-items:center; gap:12px; }
        .profile-form-heading .avatar-large { flex-shrink:0; }
        .copy-field { max-width:100%; }

        .public-nav { width:calc(100% - 24px); margin-top:8px; }
        .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width:calc(100% - 24px); }
        .profile-hero { min-height:auto; gap:26px; padding:38px 0 46px; }
        .profile-image { width:100%; min-height:220px; }
        .profile-content { width:100%; max-width:100%; display:flex; flex-direction:column; align-items:center; }
        .profile-content h1 { font-size:clamp(38px,12vw,54px); max-width:100%; overflow-wrap:anywhere; }
        .profile-facts { width:100%; align-items:center; flex-direction:column; margin-top:15px; }
        .service-card { width:100%; min-height:0; padding:15px; gap:13px; }
        .contact-strip, .location-section { align-items:center; flex-direction:column; padding:18px; text-align:center; }
        .location-section { padding:44px 0 52px; }
        .public-shell footer { align-items:flex-start; flex-direction:column; }
        .booking-overlay { align-items:flex-end; padding:6px !important; }
        .booking-panel { width:100%; max-width:100%; max-height:calc(100vh - 12px); border-radius:10px !important; }
        .booking-content { width:100%; padding:16px !important; box-sizing:border-box; }
        .booking-heading h2 { font-size:24px; }
        .date-grid { grid-template-columns:repeat(4,minmax(0,1fr)); width:100%; }
        .slot-grid { grid-template-columns:repeat(3,minmax(0,1fr)); width:100%; }
        .booking-receipt { grid-template-columns:1fr; }
        .booking-receipt > div { text-align:left; }
      }

      @media (prefers-reduced-motion:reduce) {
        *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
      }

      .appointment-actions{display:flex;flex-direction:column;align-items:flex-end;gap:8px;min-width:150px}
      .payment-status-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--app-line-strong,var(--border));border-radius:999px;padding:7px 10px;background:transparent;color:var(--app-muted,var(--muted));font:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:.18s ease}
      .payment-status-button:hover{transform:translateY(-1px)}
      .payment-status-button.confirmed{color:var(--app-text,#181818);background:var(--app-surface,#fff);border-color:var(--app-text,#181818)}
      .payment-status-button.pending{color:var(--app-muted,#777);background:transparent}
      .payment-status-dot{width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
      @media (max-width:720px){.appointment-actions{align-items:flex-start;min-width:0;width:100%;margin-top:4px}.appointment-price{width:100%}.payment-status-button{width:max-content}}

      .service-payment-settings{margin:4px 0 18px;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--surface-muted,#f8f8f7)}
      .service-payment-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}
      .service-payment-settings h3{margin:3px 0 0;font-size:15px}
      .service-payment-settings p{margin:8px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
      .field-help{margin-top:-8px;margin-bottom:16px;color:var(--muted);font-size:12px;line-height:1.5}
      .service-deposit{display:inline-flex;margin-top:6px;font-size:11px;font-weight:650;color:var(--muted)}
      .booking-deposit-note{padding:14px 15px;margin-bottom:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface-muted,#f8f8f7)}
      .booking-deposit-note span{display:block;font-size:12px;color:var(--muted)}
      .booking-deposit-note strong{display:block;margin-top:3px;font-size:18px}
      .booking-deposit-note p{margin:6px 0 0;font-size:12px;color:var(--muted);line-height:1.45}
      .pix-payment{width:100%;max-width:520px;margin:20px 0;padding:20px;border:1px solid var(--border);border-radius:10px;background:var(--surface-muted,#f8f8f7);text-align:left}
      .pix-payment-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .pix-payment-top h2{margin:4px 0 0;font-size:28px}
      .pix-badge{padding:5px 9px;border-radius:6px;background:#dff5e8;color:#187343;font-size:12px;font-weight:700}
      .pix-payment>p{font-size:13px;color:var(--muted);line-height:1.5}
      .pix-key-box{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--border);border-radius:7px;background:var(--surface,#fff)}
      .pix-key-box span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
      .pix-key-box button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;font-weight:600;cursor:pointer}
      .pix-missing{padding:12px;border-radius:7px;background:#fff3e6;color:#8a4a00;font-size:13px;line-height:1.45}

      /* DARK THEME */
      :root {
        color-scheme: dark;
        --ui-ink: #f4f5f6;
        --ui-ink-2: #d5d8dc;
        --ui-muted: #9da3aa;
        --ui-soft: #1b1d20;
        --ui-soft-2: #25282c;
        --ui-line: rgba(255,255,255,.09);
        --ui-line-strong: rgba(255,255,255,.16);
        --ui-white: rgba(28,30,33,.9);
        --ui-shadow-sm: 0 8px 24px rgba(0,0,0,.24);
        --ui-shadow: 0 18px 50px rgba(0,0,0,.32);
        --app-bg: #111315;
        --app-surface: #191b1e;
        --app-surface-soft: #202328;
        --app-text: #f4f5f6;
        --app-text-2: #d0d4d8;
        --app-muted: #9da3aa;
        --app-line: rgba(255,255,255,.09);
        --app-line-strong: rgba(255,255,255,.16);
        --app-shadow: 0 18px 50px rgba(0,0,0,.32);
      }

      body { background:var(--app-bg); color:var(--app-text); }
      .brand-mark { background:#f4f5f6; color:#111214; box-shadow:0 8px 20px rgba(0,0,0,.28); }
      .brand-dot { color:#686e76; }
      .eyebrow,
      .muted,
      .page-title p,
      .auth-lead,
      .profile-description,
      .contact-strip p,
      .location-section p,
      .appointment-time span,
      .appointment-info span,
      .metric-card > span,
      .metric-card p,
      .closed,
      .text-link { color:var(--app-muted); }

      .button-primary,
      .button-dark { color:#111214; background:#f4f5f6; box-shadow:0 10px 24px rgba(0,0,0,.3); }
      .button-soft { color:#f0f2f4; background:#202328; border-color:var(--app-line-strong); box-shadow:none; }
      .button-ghost { color:#b3b8be; }
      .button-danger { color:#ffb1b1; background:#321d1f; border-color:rgba(255,120,120,.16); }
      .icon-button { color:#e8eaec; background:#1c1f22; border-color:var(--app-line); }
      .icon-button:hover { background:#25282c; }

      .field > span,
      .media-field > span { color:#c9cdd1; }
      .field input,
      .field textarea,
      .time-inputs input,
      .hours-row input[type='time'] {
        background:#1b1e21 !important;
        color:#f4f5f6 !important;
        border-color:var(--app-line-strong) !important;
        box-shadow:none !important;
      }
      .field input::placeholder,
      .field textarea::placeholder { color:#747b83; }
      .field input:focus,
      .field textarea:focus { border-color:rgba(255,255,255,.34) !important; box-shadow:0 0 0 3px rgba(255,255,255,.06) !important; }
      .form-error { color:#ffb2b2; background:#321d1f; border-color:rgba(255,120,120,.15); }
      .saved { color:#a7e1bb; background:#182a20; border-color:rgba(120,220,155,.14); }

      .center-page { background:radial-gradient(circle at 50% 15%,#25282c,transparent 36%),#111315; }
      .panel,
      .auth-card,
      .dashboard-section,
      .form-card,
      .hours-card,
      .link-card { background:rgba(25,27,30,.94); border-color:var(--app-line); box-shadow:var(--app-shadow); }
      .panel.centered p { color:var(--app-muted); }

      .auth-aside::after,
      .public-shell::before { border-color:rgba(255,255,255,.07); }
      .auth-aside p { color:#a8adb3; }
      .home-note { color:#a4aab0; background:rgba(255,255,255,.04); border-color:var(--app-line); }

      .auth-page { background:#111315; }
      .auth-aside { background:radial-gradient(circle at 72% 30%,#24272b,transparent 25%),linear-gradient(145deg,#151719,#202328); border-color:var(--app-line); }
      .auth-card { background:#191b1e; }
      .switch-auth { color:#9299a1; }
      .switch-auth button { color:#f4f5f6; }

      .public-shell { background:radial-gradient(circle at 78% 8%,color-mix(in srgb,var(--profile-primary,#fff) 8%,#191b1e),transparent 26%),#151719; }
      .public-nav { background:rgba(25,27,30,.88); border-color:var(--app-line); }
      .public-links a { color:#a8adb3; }
      .public-links a:hover { color:#fff; background:rgba(255,255,255,.06); }
      .profile-image::before { background:linear-gradient(145deg,#202328,#151719); border-color:var(--app-line); box-shadow:20px 25px 55px rgba(0,0,0,.3); }
      .profile-image .avatar { border-color:#202328; }
      .profile-specialty { color:#d5d8dc; }
      .profile-facts span { background:rgba(255,255,255,.04); border-color:var(--app-line); color:#b6bbc1; }
      .service-card { background:#191b1e; border-color:var(--app-line); box-shadow:0 7px 24px rgba(0,0,0,.2); }
      .service-card:hover { border-color:var(--app-line-strong); box-shadow:0 16px 36px rgba(0,0,0,.28); }
      .service-card p,
      .service-duration { color:#9da3aa; }
      .contact-strip { background:linear-gradient(135deg,#1d2023,#151719); border-color:var(--app-line); }
      .public-shell footer { border-color:var(--app-line); color:#777e86; }

      .booking-overlay { background:rgba(0,0,0,.56) !important; }
      .booking-panel { background:rgba(25,27,30,.97) !important; border-color:rgba(255,255,255,.12) !important; box-shadow:0 28px 80px rgba(0,0,0,.48) !important; }
      .booking-top { background:rgba(25,27,30,.92) !important; border-color:var(--app-line) !important; }
      .booking-top > div:nth-child(2) small,
      .selected-service span,
      .booking-heading p,
      .summary-mini p { color:#9299a1; }
      .selected-service,
      .summary-mini { background:linear-gradient(135deg,#202328,#191b1e); border-color:var(--app-line); box-shadow:none; }
      .selected-service button,
      .back-link { color:#b9bec4; }
      .date-grid button,
      .slot-grid button { background:#1b1e21; color:#c8cdd2; border-color:var(--app-line-strong); }
      .date-grid button.selected,
      .slot-grid button.selected { color:#111214; }
      .slot-area { background:#17191c; border-color:var(--app-line); }
      .booking-receipt { background:var(--app-line); border-color:var(--app-line); }
      .booking-receipt > div { background:#1c1f22; }
      .booking-receipt span { color:#858c94; }
      .confirmation > p { color:#9da3aa; }

      .dashboard-shell { background:#111315; }
      .sidebar { background:rgba(25,27,30,.9); border-color:var(--app-line); }
      .side-profile { background:rgba(255,255,255,.035); border-color:var(--app-line); }
      .side-profile span { color:#8e959d; }
      .sidebar nav a { color:#9da3aa; }
      .sidebar nav a:hover { color:#f4f5f6; background:rgba(255,255,255,.05); }
      .sidebar nav a.active { color:#fff; background:rgba(255,255,255,.08); }
      .sidebar nav a.active::before { background:#f4f5f6; }
      .logout { color:#9299a1; }
      .logout:hover { color:#ffb1b1; background:#321d1f; }
      .dashboard-top { background:rgba(17,19,21,.86); border-color:var(--app-line); }
      .top-kicker { color:#858c94; }
      .public-link { background:#1c1f22; color:#c4c9ce; border-color:var(--app-line); }
      .metric-card,
      .appointment-card,
      .service-admin,
      .block-row,
      .hour-row { background:#191b1e; border-color:var(--app-line); }
      .metric-card::after { background:#25282c; }
      .appointment-card:hover,
      .service-admin:hover,
      .block-row:hover,
      .hour-row:hover { border-color:var(--app-line-strong); box-shadow:0 9px 22px rgba(0,0,0,.22); }
      .tabs { background:#1b1e21; border-color:var(--app-line); }
      .tabs button { color:#949ba3; }
      .tabs button.active { color:#f4f5f6; background:#292c30; box-shadow:none; }
      .small-action { background:#202328; color:#c0c5ca; border-color:var(--app-line); }
      .small-action.danger { color:#ffadad; }
      .copy-field { background:#1b1e21; border-color:var(--app-line-strong); }
      .copy-field span { color:#a7adb4; }
      .copy-field button { background:#292c30; color:#e7e9eb; }
      .hours-row > div[style] > div { border-color:var(--app-line) !important; }
      .empty { background:rgba(255,255,255,.025); border-color:rgba(255,255,255,.14); }
      .empty-icon,
      .link-card-icon { background:#25282c; }
      .empty p { color:#858c94; }


      @media (max-width: 900px) {
        .public-links { background:rgba(25,27,30,.98); border-color:var(--app-line); }
      }
      .return-radar-section { overflow:visible; }
      .return-radar-summary { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px; margin-bottom:14px; }
      .return-radar-stat { min-height:72px; border:1px solid var(--app-line-strong); border-radius:10px; background:var(--app-surface); padding:11px 12px; display:grid; grid-template-columns:auto 1fr; grid-template-rows:auto auto; column-gap:8px; align-items:center; }
      .return-radar-stat span { grid-row:1 / span 2; font-size:14px; }
      .return-radar-stat strong { font-size:20px; line-height:1; }
      .return-radar-stat small { color:var(--app-muted); font-size:10px; margin-top:2px; }
      .return-radar-groups { display:grid; gap:10px; }
      .return-radar-group-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
      .return-radar-group-heading > div > span { color:var(--app-muted); font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
      .return-radar-group-heading h3 { margin:3px 0 0; font-size:13px; letter-spacing:-.02em; }
      .return-radar-group-heading > strong { min-width:24px; height:24px; display:grid; place-items:center; border:1px solid var(--app-line); border-radius:999px; color:var(--app-muted); font-size:11px; }
      .return-radar-list { display:grid; gap:6px; }
      .return-radar-card { display:flex; align-items:center; justify-content:space-between; gap:14px; border:1px solid var(--app-line); border-radius:9px; background:var(--app-surface); padding:11px 12px; }
      .return-radar-main { min-width:0; display:grid; gap:3px; }
      .return-radar-main > strong { font-size:13px; color:var(--app-text); }
      .return-radar-main > span { font-size:11px; color:var(--app-text-2); }
      .return-radar-main > small { font-size:10px; color:var(--app-muted); }
      .return-radar-main > b { font-size:10px; font-weight:700; color:var(--app-text-2); }
      .return-radar-message { flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; gap:6px; border:1px solid var(--app-line-strong); border-radius:7px; padding:8px 10px; background:var(--app-text); color:var(--app-bg); font:inherit; font-size:10px; font-weight:700; cursor:pointer; }
      .return-radar-message:hover { opacity:.88; }
      .return-radar-no-whatsapp { flex:0 0 auto; color:var(--app-muted); font-size:9px; }
      .return-radar-more { display:block; margin-top:7px; color:var(--app-muted); font-size:10px; }
      .return-radar-empty { display:flex; align-items:center; gap:12px; padding:14px 2px 3px; color:var(--app-text-2); }
      .return-radar-empty .empty-icon { flex:0 0 auto; }
      .return-radar-empty strong { font-size:12px; }
      .return-radar-empty p { margin:3px 0 0; color:var(--app-muted); font-size:10px; }
      .return-message-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:18px; background:rgba(0,0,0,.62); }
      .return-message-modal { width:min(520px, 100%); border:1px solid var(--app-line-strong); border-radius:12px; background:var(--app-surface); padding:18px; box-shadow:0 24px 80px rgba(0,0,0,.35); }
      .return-message-top { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:15px; }
      .return-message-top h2 { margin:5px 0 0; font-size:18px; line-height:1.12; letter-spacing:-.035em; color:var(--app-text); }
      .return-message-field { margin:0 !important; }
      .return-message-field textarea { min-height:150px; resize:vertical; }
      .return-message-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:13px; }
      .return-message-actions .button { min-width:120px; }
      @media (max-width:640px) {
        .return-radar-summary { grid-template-columns:repeat(3, minmax(0, 1fr)); }
        .return-radar-stat { min-height:64px; padding:9px; }
        .return-radar-stat strong { font-size:18px; }
        .return-radar-card { align-items:stretch; flex-direction:column; gap:9px; }
        .return-radar-message { width:100%; min-height:40px; }
        .return-radar-no-whatsapp { padding-top:3px; }
        .return-message-overlay { align-items:end; padding:8px; }
        .return-message-modal { width:100%; border-radius:11px; padding:15px; }
        .return-message-field textarea { min-height:170px; }
        .return-message-actions { display:grid; grid-template-columns:1fr 1.25fr; }
        .return-message-actions .button { width:100%; min-width:0; }
      }
      /* FINAL PRODUCT UI — less decoration, more system */
      .brand { text-decoration:none !important; }
      .brand-button { border:0; padding:0; margin:0; background:transparent; color:inherit; font:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:10px; }
      .brand-mark, .brand-dot { display:none !important; }
      .profile-image::before { display:none !important; }
      .button::after { display:none !important; }
      .button, .button-soft, .button-primary, .button-dark, .button-danger,
      .small-action, .tabs, .tabs button, .field input, .field textarea, .field select,
      .time-inputs input, .hours-row input[type='time'], .copy-field, .service-card,
      .contact-strip, .selected-service, .summary-mini, .date-grid button, .slot-grid button,
      .dashboard-section, .form-card, .hours-card, .link-card, .metric-card,
      .appointment-card, .service-admin, .block-row, .hour-row, .sidebar,
      .public-nav, .pix-payment, .booking-deposit-note, .service-payment-settings {
        box-shadow:none !important;
      }
      .button:hover, .small-action:hover, .date-grid button:hover, .slot-grid button:hover,
      .service-card:hover, .appointment-card:hover, .service-admin:hover, .block-row:hover,
      .hour-row:hover, .metric-card:hover { transform:none !important; }
      .field input, .field textarea, .field select,
      .time-inputs input, .hours-row input[type='time'] {
        background:var(--app-surface) !important;
        color:var(--app-text) !important;
        border-color:var(--app-line-strong) !important;
        box-shadow:none !important;
      }
      .field select { min-height:42px; width:100%; border:1px solid var(--app-line-strong); border-radius:8px; padding:0 12px; }
      .field input::placeholder, .field textarea::placeholder { color:var(--app-muted) !important; opacity:1; }
      .button-primary, .button-dark { background:var(--app-text) !important; color:var(--app-bg) !important; border-color:var(--app-text) !important; }
      .button-primary, .button-dark { background:var(--app-text) !important; color:var(--app-bg) !important; }
      .button-soft, .small-action { background:var(--app-surface) !important; color:var(--app-text) !important; border-color:var(--app-line-strong) !important; }
      .date-grid button, .slot-grid button { background:var(--app-surface) !important; color:var(--app-text-2) !important; border-color:var(--app-line-strong) !important; box-shadow:none !important; }
      .date-grid button.selected, .slot-grid button.selected { background:var(--app-text) !important; color:var(--app-bg) !important; border-color:var(--app-text) !important; box-shadow:none !important; }
      .service-payment-settings,
      .booking-deposit-note,
      .pix-payment { background:var(--app-surface) !important; color:var(--app-text) !important; border-color:var(--app-line-strong) !important; }
      .service-payment-settings h3, .payment-final-value strong, .pix-payment-top h2 { color:var(--app-text) !important; }
      .service-payment-settings p, .payment-final-value small, .booking-deposit-note p, .pix-payment > p { color:var(--app-muted) !important; }
      .pix-badge { background:var(--app-surface-soft) !important; color:var(--app-text) !important; border:1px solid var(--app-line) !important; }
      .pix-missing { background:var(--app-surface-soft) !important; color:var(--app-text-2) !important; border:1px solid var(--app-line) !important; }
      .pix-key-box { background:var(--app-surface-soft) !important; border-color:var(--app-line-strong) !important; color:var(--app-text) !important; }
      .payment-final-value { margin-top:12px; padding:12px 0 0; border-top:1px solid var(--app-line); display:grid; gap:3px; }
      .payment-final-value span { font-size:12px; color:var(--app-muted); }
      .payment-final-value strong { font-size:20px; }
      .payment-final-value small { font-size:12px; }
      .hours-settings { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:16px 18px; border-bottom:1px solid var(--app-line); }
      .hours-settings strong { font-size:14px; }
      .hours-settings p { margin:5px 0 0; color:var(--app-muted); font-size:12px; }
      .interval-field { width:190px; margin:0 !important; }
      .hours-list { display:grid; }
      .hours-preview { grid-column:2; color:var(--app-muted); font-size:11px; }
      .hours-row { box-shadow:none !important; }
      .public-shell { background:var(--app-bg) !important; }
      .public-nav { box-shadow:none !important; }
      .profile-image { background:transparent !important; }
      .service-card, .contact-strip, .selected-service, .summary-mini { background:var(--app-surface) !important; }
      .booking-panel { box-shadow:0 16px 40px rgba(0,0,0,.14) !important; }
      .booking-overlay { backdrop-filter:none !important; }
      .sidebar { box-shadow:none !important; }
      @media (max-width:640px) {
        .hours-settings { align-items:stretch; flex-direction:column; gap:12px; }
        .interval-field { width:100%; }
        .hours-preview { grid-column:1; }
      }

      /* INTELLIGENCE DASHBOARD */
      .intelligence-today { margin-bottom:14px; }
      .intelligence-actions { display:grid; gap:7px; }
      .intelligence-action { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:12px 13px; border:1px solid var(--app-line); border-radius:8px; background:var(--app-surface); }
      .intelligence-action strong { display:block; font-size:12px; }
      .intelligence-action p { margin:3px 0 0; color:var(--app-muted); font-size:10px; line-height:1.45; }
      .intelligence-action-link { width:auto; min-width:max-content; height:auto; text-decoration:none; }
      .intelligence-revenue { margin-bottom:14px; }
      .intelligence-revenue-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:7px; }
      .intelligence-revenue-grid > div { padding:12px; border:1px solid var(--app-line); border-radius:8px; background:var(--app-surface); }
      .intelligence-revenue-grid span,.intelligence-revenue-grid small { display:block; color:var(--app-muted); font-size:9px; }
      .intelligence-revenue-grid strong { display:block; margin:7px 0 3px; font-size:19px; letter-spacing:-.04em; }
      .intelligence-two-column { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin:14px 0; }
      .intelligence-list-section { min-width:0; }
      .intelligence-customer-list { display:grid; gap:6px; }
      .intelligence-customer { width:100%; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:11px 12px; border:1px solid var(--app-line); border-radius:8px; background:var(--app-surface); color:var(--app-text); text-align:left; cursor:pointer; }
      .intelligence-customer:hover { border-color:var(--app-line-strong); }
      .intelligence-customer > div { min-width:0; display:grid; gap:3px; }
      .intelligence-customer strong { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .intelligence-customer span,.intelligence-customer small { color:var(--app-muted); font-size:9px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .intelligence-empty { padding:18px 8px; color:var(--app-muted); font-size:10px; line-height:1.5; text-align:center; border:1px dashed var(--app-line-strong); border-radius:8px; }
      .intelligence-empty-slots { margin-bottom:14px; }
      .empty-slot-list { display:grid; gap:6px; }
      .empty-slot-card { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:11px 12px; border:1px solid var(--app-line); border-radius:8px; background:var(--app-surface); }
      .empty-slot-card > div { min-width:0; display:grid; gap:3px; }
      .empty-slot-card strong { font-size:12px; }
      .empty-slot-card span { font-size:10px; color:var(--app-text-2); }
      .empty-slot-card small { color:var(--app-muted); font-size:9px; }
      .customer-profile-modal { width:min(620px,100%); max-height:calc(100vh - 36px); overflow:auto; border:1px solid var(--app-line-strong); border-radius:12px; background:var(--app-surface); padding:18px; box-shadow:0 24px 80px rgba(0,0,0,.35); }
      .customer-profile-status { display:inline-flex; padding:6px 9px; border:1px solid var(--app-line); border-radius:999px; color:var(--app-text-2); font-size:10px; font-weight:750; }
      .customer-profile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin:14px 0; }
      .customer-profile-grid > div { padding:10px; border:1px solid var(--app-line); border-radius:8px; background:var(--app-surface-soft); }
      .customer-profile-grid span { display:block; color:var(--app-muted); font-size:8px; text-transform:uppercase; letter-spacing:.06em; }
      .customer-profile-grid strong { display:block; margin-top:5px; font-size:11px; overflow-wrap:anywhere; }
      .customer-history { display:grid; gap:6px; margin-top:14px; }
      .customer-history > div { display:grid; grid-template-columns:70px 1fr auto; align-items:center; gap:8px; padding:9px 10px; border:1px solid var(--app-line); border-radius:7px; }
      .customer-history > div span { color:var(--app-muted); font-size:9px; }
      .customer-history > div strong { font-size:10px; }
      .customer-history > div b { font-size:10px; }
      @media (max-width:720px) {
        .intelligence-two-column { grid-template-columns:1fr; }
        .intelligence-revenue-grid { grid-template-columns:1fr 1fr; }
      }
      @media (max-width:640px) {
        .intelligence-action { align-items:flex-start; }
        .intelligence-action .small-action { min-width:max-content; width:auto; padding:0 10px; }
        .intelligence-revenue-grid { gap:6px; }
        .intelligence-revenue-grid > div { padding:10px; }
        .intelligence-revenue-grid strong { font-size:16px; }
        .empty-slot-card { align-items:stretch; flex-direction:column; }
        .empty-slot-card .return-radar-message { width:100%; }
        .customer-profile-modal { max-height:calc(100vh - 20px); padding:15px; }
        .customer-profile-grid { grid-template-columns:1fr 1fr; }
      }
      .return-radar-stat { border:0; cursor:pointer; text-align:left; font:inherit; }
      .return-radar-stat.selected { outline:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.08); }
      .intelligence-customer { display:flex; align-items:center; gap:12px; }
      .intelligence-customer-main { flex:1; display:flex; align-items:center; gap:12px; border:0; background:none; color:inherit; text-align:left; cursor:pointer; padding:0; font:inherit; }
      .intelligence-customer > .return-radar-message { flex:0 0 auto; }
      .radar-group.no-next.expanded { margin-top:14px; }

      /* MOBILE / CLARITY FIXES */
      .service-card::before { display:none !important; }

      /* Remove decorative status dots / color treatment from return radar */
      .return-radar-summary .return-radar-stat::before,
      .return-radar-summary .return-radar-stat::after,
      .return-radar-summary .overdue::before,
      .return-radar-summary .upcoming::before,
      .return-radar-summary .no-next::before { display:none !important; content:none !important; }
      .return-radar-summary .return-radar-stat { grid-template-columns:1fr !important; }
      .return-radar-summary .return-radar-stat span { display:none !important; }

      /* Perfil 360º: never allow content to escape the mobile viewport */
      .customer-profile-modal {
        width:min(620px, calc(100vw - 20px)) !important;
        max-width:calc(100vw - 20px) !important;
        box-sizing:border-box !important;
        overflow-x:hidden !important;
      }
      .customer-profile-modal * { max-width:100%; box-sizing:border-box; }
      .customer-profile-grid { grid-template-columns:repeat(2,minmax(0,1fr)); min-width:0; }
      .customer-profile-grid > div { min-width:0; overflow:hidden; }
      .customer-profile-grid strong { min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      .customer-history { min-width:0; }
      .customer-history > div { min-width:0; grid-template-columns:minmax(62px,auto) minmax(0,1fr) auto; }
      .customer-history > div strong,
      .customer-history > div b { min-width:0; overflow-wrap:anywhere; word-break:break-word; }

      /* Blocks: date/time fields stay inside the card on narrow screens */
      .form-card .field input[type='datetime-local'] {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        box-sizing:border-box !important;
        display:block;
      }
      .block-list, .block-row, .block-row > div { min-width:0; max-width:100%; }
      .block-row { overflow:hidden; }
      .block-row > div:first-child, .block-row > div:last-child { min-width:0; }
      .block-row span, .block-row strong { overflow-wrap:anywhere; word-break:break-word; }

      /* Services: prevent text/button collisions and keep Editar inside its button */
      .service-admin { min-width:0; overflow:hidden; }
      .service-admin > div:first-child { min-width:0; flex:1 1 auto; overflow:hidden; }
      .service-admin > div:first-child strong,
      .service-admin > div:first-child span { display:block; min-width:0; overflow-wrap:anywhere; word-break:break-word; }
      .service-admin > div:last-child { flex:0 0 auto; min-width:0; }
      .service-admin > div:last-child .small-action {
        width:auto !important;
        min-width:0 !important;
        max-width:100%;
        padding:7px 9px !important;
        white-space:nowrap;
        overflow:hidden;
        box-sizing:border-box;
      }
      .service-admin > div:last-child .small-action:first-child { width:52px !important; }
      .service-admin > div:last-child .small-action.danger { width:34px !important; }

      @media (max-width:640px) {
        .customer-profile-modal {
          width:calc(100vw - 16px) !important;
          max-width:calc(100vw - 16px) !important;
          padding:14px !important;
          max-height:calc(100vh - 16px) !important;
        }
        .customer-profile-grid { grid-template-columns:1fr 1fr; gap:6px; }
        .customer-profile-grid > div { padding:9px 8px; }
        .customer-history > div { grid-template-columns:58px minmax(0,1fr); gap:5px; }
        .customer-history > div b { grid-column:2; justify-self:start; }
        .return-message-actions { grid-template-columns:1fr !important; }

        .block-list + .form-card, .two-column > .form-card { min-width:0; }
        .two-column { min-width:0; }
        .time-inputs { width:100% !important; min-width:0 !important; }
        .time-inputs input { min-width:0 !important; width:0 !important; flex:1 1 0 !important; }

        .service-admin { align-items:center; gap:8px; padding:10px !important; }
        .service-admin > div:first-child { max-width:calc(100% - 92px); }
        .service-admin > div:last-child { width:86px; display:flex; justify-content:flex-end; gap:4px; }
        .service-admin > div:last-child .small-action:first-child { width:48px !important; padding:6px 5px !important; font-size:9px !important; }
        .service-admin > div:last-child .small-action.danger { width:32px !important; padding:6px !important; }
      }

      .intelligence-revenue-grid { min-width:0; }
      .intelligence-revenue-grid > div { min-width:0; overflow:hidden; }
      .intelligence-revenue-grid strong { overflow-wrap:anywhere; word-break:break-word; }
      @media (max-width:640px) {
        .intelligence-revenue-grid { grid-template-columns:1fr 1fr !important; }
        .intelligence-revenue-grid > div { padding:10px 9px; }
        .intelligence-revenue-grid strong { font-size:17px; }
      }

      /* FINAL MOBILE-FIRST CLARITY FIXES */
      .overview-revenue { margin-bottom:14px; }
      .overview-revenue .section-heading { min-width:0; }
      .overview-revenue .section-heading > div { min-width:0; }
      .overview-revenue .section-heading h2 { overflow-wrap:anywhere; }

      .customer-profile-modal {
        width:min(620px, calc(100vw - 24px)) !important;
        max-width:calc(100vw - 24px) !important;
        min-width:0 !important;
        box-sizing:border-box !important;
        overflow-x:hidden !important;
      }
      .customer-profile-modal > * { min-width:0; max-width:100%; }
      .customer-profile-grid {
        width:100% !important;
        min-width:0 !important;
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      }
      .customer-profile-grid > div { min-width:0 !important; overflow:hidden; }
      .customer-profile-grid strong,
      .customer-profile-modal p,
      .customer-profile-modal span,
      .customer-profile-modal strong,
      .customer-profile-modal b {
        min-width:0;
        max-width:100%;
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      .customer-history { width:100%; min-width:0; }
      .customer-history > div {
        width:100%;
        min-width:0 !important;
        box-sizing:border-box;
        grid-template-columns:minmax(58px,auto) minmax(0,1fr) auto !important;
      }
      .customer-history > div > * { min-width:0; }

      .intelligence-customer { min-width:0; width:100%; box-sizing:border-box; }
      .intelligence-customer-main { min-width:0; width:100%; }
      .intelligence-customer-main > div { min-width:0; max-width:100%; }
      .intelligence-customer-main strong,
      .intelligence-customer-main span,
      .intelligence-customer-main small { overflow-wrap:anywhere; word-break:break-word; }
      .return-radar-card { min-width:0; box-sizing:border-box; }
      .return-radar-main { min-width:0; max-width:100%; }
      .return-radar-main > strong, .return-radar-main > span, .return-radar-main > small, .return-radar-main > b { overflow-wrap:anywhere; word-break:break-word; }

      .form-card { min-width:0; box-sizing:border-box; }
      .form-card .field,
      .form-card .field input,
      .form-card .field textarea,
      .form-card .field select { min-width:0; max-width:100%; box-sizing:border-box; }
      .form-card .field input[type='datetime-local'] {
        width:100% !important;
        min-width:0 !important;
        max-width:100% !important;
        display:block;
        font-size:16px;
        padding-left:11px;
        padding-right:8px;
      }

      .service-admin {
        display:grid !important;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        min-width:0;
        width:100%;
        box-sizing:border-box;
      }
      .service-admin > div:first-child { min-width:0 !important; width:100%; overflow:hidden; }
      .service-admin > div:first-child strong,
      .service-admin > div:first-child span {
        display:block;
        min-width:0;
        max-width:100%;
        overflow-wrap:anywhere;
        word-break:break-word;
      }
      .service-admin > div:last-child {
        display:flex !important;
        align-items:center;
        justify-content:flex-end;
        flex:none !important;
        width:auto !important;
        min-width:0 !important;
        gap:5px;
      }
      .service-admin > div:last-child .small-action {
        display:inline-flex !important;
        align-items:center;
        justify-content:center;
        flex:none !important;
        box-sizing:border-box !important;
        height:34px !important;
        min-height:34px !important;
        margin:0 !important;
        padding:0 9px !important;
        line-height:1 !important;
        white-space:nowrap !important;
        overflow:hidden !important;
        text-overflow:clip !important;
      }
      .service-admin > div:last-child .small-action:first-child { width:54px !important; min-width:54px !important; }
      .service-admin > div:last-child .small-action.danger { width:34px !important; min-width:34px !important; padding:0 !important; }

      /* Remove the decorative quarter-circle from service cards on the public client page. */
      .public-shell .service-card::before { display:none !important; content:none !important; }

      @media (max-width:640px) {
        .dashboard-content { overflow-x:hidden; }
        .overview-revenue .section-heading { align-items:flex-start; flex-direction:column; gap:8px; }
        .overview-revenue .section-heading .text-link { align-self:flex-start; }
        .intelligence-revenue-grid { grid-template-columns:1fr 1fr !important; width:100%; }
        .intelligence-revenue-grid > div { min-width:0; overflow:hidden; }
        .intelligence-revenue-grid strong { font-size:16px !important; overflow-wrap:anywhere; }

        .customer-profile-modal {
          width:calc(100vw - 16px) !important;
          max-width:calc(100vw - 16px) !important;
          padding:13px !important;
        }
        .customer-profile-grid { grid-template-columns:1fr !important; gap:6px; }
        .customer-history > div {
          grid-template-columns:1fr !important;
          align-items:flex-start;
          gap:3px;
          padding:9px;
        }
        .customer-history > div b { grid-column:auto !important; justify-self:start; }

        .block-list, .block-row { width:100%; min-width:0; }
        .block-row { display:grid !important; grid-template-columns:minmax(0,1fr) auto; gap:8px; }
        .block-row > div { min-width:0; max-width:100%; }
        .block-row > div:last-child { display:flex; align-items:center; gap:6px; }
        .block-row span, .block-row strong { overflow-wrap:anywhere; word-break:break-word; }
        .two-column > .form-card { width:100%; min-width:0; }

        .service-admin { grid-template-columns:minmax(0,1fr) 91px !important; gap:7px !important; padding:10px !important; }
        .service-admin > div:last-child { width:91px !important; }
        .service-admin > div:first-child strong { font-size:12px; line-height:1.25; }
        .service-admin > div:first-child span { font-size:10px; line-height:1.35; }
        .service-admin > div:last-child .small-action:first-child { width:52px !important; min-width:52px !important; height:32px !important; min-height:32px !important; padding:0 !important; font-size:9px !important; }
        .service-admin > div:last-child .small-action.danger { width:32px !important; min-width:32px !important; height:32px !important; min-height:32px !important; }

        .form-card .form-row { grid-template-columns:1fr !important; }
        .form-card .service-payment-settings { min-width:0; width:100%; box-sizing:border-box; }
        .service-payment-settings .field select { width:100% !important; min-width:0 !important; }
      }

    `}</style>
  );
}

export default function App() {
  return (
    <>
      <DesignSystem />
      <AppContent />
    </>
  );
}

function AppContent() {

  const [session, setSession] = useState<{
    user: { id: string };
  } | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(
        data.session as {
          user: { id: string };
        } | null,
      );

      setLoading(false);
    });

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, current) =>
        setSession(
          current as {
            user: { id: string };
          } | null,
        ),
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="center-page">
        <LoaderCircle className="spin" />
      </div>
    );
  }

  const path = window.location.pathname;

  if (path.startsWith('/agendar/')) {
    return (
      <PublicPage
        slug={path.split('/')[2] || ''}
      />
    );
  }

  if (path === '/cadastro') {
    return <AuthPage initialMode="signup" />;
  }

  if (path === '/login') {
    return <AuthPage initialMode="login" />;
  }

  if (path.startsWith('/dashboard')) {
    return session ? (
      <Dashboard userId={session.user.id} />
    ) : (
      <AuthPage />
    );
  }

  return <AuthPage initialMode="signup" />;
}
