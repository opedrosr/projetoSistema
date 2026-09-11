import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  Sparkles,
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

const navItems = [
  ['/dashboard', 'Início'],
  ['/dashboard/agendamentos', 'Agendamentos'],
  ['/dashboard/servicos', 'Serviços'],
  ['/dashboard/horarios', 'Horários'],
  ['/dashboard/bloqueios', 'Bloqueios'],
  ['/dashboard/perfil', 'Meu perfil'],
];

type PublicData = Awaited<ReturnType<typeof getPublicProfile>>;
type OwnerData = Awaited<ReturnType<typeof getOwnerData>>;
type CustomProfile = Profile & {
  logo_url?: string | null;
  description?: string | null;
  primary_color?: string | null;
};

function customProfile(profile: Profile): CustomProfile {
  return profile as CustomProfile;
}

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
    <a className="brand" href="/">
      <span className="brand-mark">
        <Sparkles size={15} />
      </span>
      <span>
        agenda<span className="brand-dot">.</span>me
      </span>
    </a>
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
  const [selected, setSelected] = useState<Service | null>(null);
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<Partial<BookingData>>({});
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);
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
          <a href="/login" className="button button-primary">
            Acessar minha conta <ArrowRight size={16} />
          </a>
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
    return (
      <div className="public-shell">
        <PublicNav
          profile={profile}
          onMenu={() => setMobileMenu(!mobileMenu)}
          open={mobileMenu}
        />

        <main className="confirmation">
          <div className="success-mark">
            <Check size={30} />
          </div>

          <div className="eyebrow">Agendamento confirmado</div>

          <h1>Seu horário está reservado.</h1>

          <p>Pronto. Enviamos todos os detalhes para você guardar.</p>

          <div className="booking-receipt">
            <div>
              <span>Serviço</span>
              <strong>{selected?.name}</strong>
            </div>

            <div>
              <span>Data e horário</span>
              <strong>
                {booking.date && formatDate(booking.date)} · {booking.time}
              </strong>
            </div>

            <div>
              <span>Profissional</span>
              <strong>{profile.business_name || profile.name}</strong>
            </div>
          </div>

          <a
            className="button button-primary"
            href={whatsappUrl(
              profile.whatsapp,
              `Olá! Agendei ${selected?.name} para ${
                booking.date ? formatDate(booking.date) : ''
              } às ${booking.time}.`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} />
            Falar com a profissional
          </a>
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
        <a href="/login">
          Sou profissional <ArrowRight size={14} />
        </a>
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
      <a className="brand" href="/">
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
        ) : (
          <span className="brand-mark">
            <Sparkles size={15} />
          </span>
        )}
        <span>
          {custom.business_name || 'agenda'}
          {!custom.business_name && <span className="brand-dot">.</span>}
        </span>
      </a>

      <div className={`public-links ${open ? 'open' : ''}`}>
        <a href="#servicos">Serviços</a>
        <a href="#localizacao">Localização</a>

        {profile.whatsapp && (
          <a
            href={whatsappUrl(profile.whatsapp)}
            target="_blank"
            rel="noreferrer"
          >
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

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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
                <Sparkles size={17} />
              ) : label === 'Agendamentos' ? (
                <CalendarDays size={17} />
              ) : label === 'Serviços' ? (
                <Scissors size={17} />
              ) : label === 'Horários' ? (
                <Clock3 size={17} />
              ) : label === 'Bloqueios' ? (
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

  const todays = data.appointments.filter(
    (item) =>
      item.starts_at.slice(0, 10) === today &&
      item.status === 'confirmed',
  );

  const next = data.appointments.find(
    (item) =>
      item.status === 'confirmed' &&
      new Date(item.starts_at) >= new Date(),
  );

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">Visão geral</div>
          <h1>Bom te ver por aqui.</h1>
          <p>
            O essencial da sua agenda, sem complicação.
          </p>
        </div>

        <a
          className="button button-primary"
          href="/dashboard/perfil"
        >
          <Settings2 size={17} />
          Configurar perfil
        </a>
      </div>

      <div className="overview-grid">
        <div className="metric-card warm">
          <span>Hoje</span>
          <strong>{todays.length}</strong>
          <p>
            {todays.length === 1
              ? 'agendamento marcado'
              : 'agendamentos marcados'}
          </p>
        </div>

        <div className="metric-card">
          <span>Serviços ativos</span>
          <strong>
            {
              data.services.filter(
                (item) => item.is_active,
              ).length
            }
          </strong>
          <p>visíveis na sua página</p>
        </div>

        <div className="metric-card">
          <span>Seu link</span>
          <strong>
            <Link2 size={22} />
          </strong>
          <p>pronto para compartilhar</p>
        </div>
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              Próximo atendimento
            </div>
            <h2>Agenda</h2>
          </div>

          <a
            className="text-link"
            href="/dashboard/agendamentos"
          >
            Ver agenda <ArrowRight size={15} />
          </a>
        </div>

        {next ? (
          <AppointmentCard appointment={next} />
        ) : (
          <Empty
            title="Sua agenda está livre"
            text="Quando alguém marcar um horário, ele aparece aqui."
          />
        )}
      </section>

      <section className="quick-actions">
        <a href="/dashboard/servicos">
          <Plus size={18} />
          <strong>Adicionar serviço</strong>
          <span>Apresente o que você faz</span>
        </a>

        <a href="/dashboard/horarios">
          <Clock3 size={18} />
          <strong>Configurar horários</strong>
          <span>Defina quando atende</span>
        </a>

        <a
          href={`/agendar/${data.profile.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={18} />
          <strong>Ver meu perfil</strong>
          <span>Veja como suas clientes veem</span>
        </a>
      </section>
    </>
  );
}

function AppointmentCard({
  appointment,
  onCancel,
}: {
  appointment: Appointment;
  onCancel?: () => void;
}) {
  return (
    <div className="appointment-card">
      <div className="appointment-time">
        <strong>
          {new Date(
            appointment.starts_at,
          ).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </strong>

        <span>
          {new Date(
            appointment.starts_at,
          )
            .toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'short',
            })
            .replace('.', '')}
        </span>
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

      <div className="appointment-price">
        {formatCurrency(appointment.price)}

        {onCancel && (
          <button
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
                appointment={appointment}
                onCancel={
                  appointment.status === 'confirmed'
                    ? () => cancel(appointment.id)
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
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    duration_minutes: '60',
  });

  const [editing, setEditing] = useState<string | null>(
    null,
  );

  async function save(event: FormEvent) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
      profile_id: data.profile.id,
      is_active: true,
    };

    if (!payload.name) {
      alert('Informe o nome do serviço.');
      return;
    }

    if (!Number.isFinite(payload.price) || payload.price < 0) {
      alert('Informe um preço válido.');
      return;
    }

    if (
      !Number.isFinite(payload.duration_minutes) ||
      payload.duration_minutes <= 0
    ) {
      alert('Informe uma duração válida.');
      return;
    }

    console.log('SALVANDO SERVIÇO:', payload);

    try {
      const result = editing
        ? await supabase
            .from('services')
            .update(payload)
            .eq('id', editing)
            .select()
            .maybeSingle()
        : await supabase
            .from('services')
            .insert(payload)
            .select()
            .maybeSingle();

      console.log('RESPOSTA DO SUPABASE - SERVIÇO:', result);

      if (result.error) {
        console.error('ERRO AO SALVAR SERVIÇO:', result.error);
        alert(`Erro ao salvar serviço: ${result.error.message}`);
        return;
      }

      if (!result.data) {
        console.error(
          'SERVIÇO NÃO RETORNADO PELO SUPABASE:',
          result,
        );
        alert('O serviço não foi retornado pelo Supabase.');
        return;
      }

      const savedService = result.data as Service;

      setData({
        ...data,
        services: editing
          ? data.services.map((item) =>
              item.id === editing ? savedService : item,
            )
          : [...data.services, savedService],
      });

      setForm({
        name: '',
        description: '',
        price: '',
        duration_minutes: '60',
      });

      setEditing(null);
    } catch (err) {
      console.error(
        'ERRO INESPERADO AO SALVAR SERVIÇO:',
        err,
      );

      const message =
        err instanceof Error ? err.message : String(err);

      alert(`Erro ao salvar serviço: ${message}`);
    }
  }


  async function remove(id: string) {
    if (!window.confirm('Excluir este serviço?')) {
      return;
    }

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (!error) {
      setData({
        ...data,
        services: data.services.filter(
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
            O que você oferece
          </div>
          <h1>Serviços</h1>
          <p>
            Mostre suas opções de forma clara para suas
            clientes.
          </p>
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
              {data.services.map((service) => (
                <div
                  className={`service-admin ${
                    !service.is_active ? 'inactive' : ''
                  }`}
                  key={service.id}
                >
                  <div>
                    <strong>{service.name}</strong>
                    <span>
                      {formatCurrency(service.price)} ·{' '}
                      {formatDuration(
                        service.duration_minutes,
                      )}
                    </span>
                  </div>

                  <div>
                    <button
                      className="small-action"
                      onClick={() => {
                        setEditing(service.id);
                        setForm({
                          name: service.name,
                          description:
                            service.description,
                          price: String(service.price),
                          duration_minutes: String(
                            service.duration_minutes,
                          ),
                        });
                      }}
                    >
                      Editar
                    </button>

                    <button
                      className="small-action danger"
                      onClick={() =>
                        remove(service.id)
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
              title="Nenhum serviço cadastrado"
              text="Adicione seu primeiro serviço para começar."
            />
          )}
        </section>

        <form className="form-card" onSubmit={save}>
          <div className="section-heading">
            <h2>
              {editing
                ? 'Editar serviço'
                : 'Novo serviço'}
            </h2>

            {editing && (
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setEditing(null);
                  setForm({
                    name: '',
                    description: '',
                    price: '',
                    duration_minutes: '60',
                  });
                }}
              >
                Cancelar
              </button>
            )}
          </div>

          <Field
            label="Nome do serviço"
            placeholder="Ex.: Corte e finalização"
            value={form.name}
            onChange={(event) =>
              setForm({
                ...form,
                name: event.target.value,
              })
            }
            required
          />

          <label className="field">
            <span>
              Descrição <em>Opcional</em>
            </span>

            <textarea
              placeholder="Descreva brevemente o serviço"
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,
                  description: event.target.value,
                })
              }
            />
          </label>

          <div className="form-row">
            <Field
              label="Preço"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={form.price}
              onChange={(event) =>
                setForm({
                  ...form,
                  price: event.target.value,
                })
              }
              required
            />

            <label className="field">
              <span>Duração</span>

              <select
                value={form.duration_minutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    duration_minutes:
                      event.target.value,
                  })
                }
              >
                <option value="30">
                  30 minutos
                </option>
                <option value="60">
                  1 hora
                </option>
                <option value="90">
                  1h30
                </option>
                <option value="120">
                  2 horas
                </option>
                <option value="150">
                  2h30
                </option>
                <option value="180">
                  3 horas
                </option>
              </select>
            </label>
          </div>

          <Button type="submit">
            {editing ? (
              'Salvar alterações'
            ) : (
              <>
                <Plus size={17} />
                Adicionar serviço
              </>
            )}
          </Button>
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
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
}) {
  const initialHours = days.map(
    (_, index) =>
      data.hours.find(
        (item) => item.day_of_week === index,
      ) || {
        profile_id: data.profile.id,
        day_of_week: index,
        is_open: false,
        start_time: '',
        end_time: '',
      },
  );

  const [hours, setHours] = useState(initialHours);
  const [slotsByDay, setSlotsByDay] = useState<string[][]>(
    days.map((_, index) =>
      data.availability
        .filter((slot) => slot.day_of_week === index)
        .map((slot) => slot.start_time.slice(0, 5))
        .sort(),
    ),
  );
  const [newSlotByDay, setNewSlotByDay] = useState<string[]>(
    days.map(() => ''),
  );
  const [saving, setSaving] = useState(false);

  function updateHour(
    index: number,
    changes: Partial<(typeof hours)[number]>,
  ) {
    setHours((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...changes }
          : item,
      ),
    );
  }

  function addSlot(dayIndex: number) {
    const value = newSlotByDay[dayIndex];
    if (!value) return;

    const hour = hours[dayIndex];
    const current = slotsByDay[dayIndex];

    if (!hour.is_open) return;

    if (hour.start_time && value < hour.start_time) {
      window.alert('Esse horário está antes do início do atendimento.');
      return;
    }

    if (hour.end_time && value >= hour.end_time) {
      window.alert('Esse horário está fora do horário de atendimento.');
      return;
    }

    if (current.includes(value)) {
      window.alert('Esse horário já foi adicionado.');
      return;
    }

    setSlotsByDay((currentDays) =>
      currentDays.map((slots, index) =>
        index === dayIndex ? [...slots, value].sort() : slots,
      ),
    );

    setNewSlotByDay((currentValues) =>
      currentValues.map((time, index) =>
        index === dayIndex ? '' : time,
      ),
    );
  }

  function removeSlot(dayIndex: number, slotIndex: number) {
    setSlotsByDay((currentDays) =>
      currentDays.map((slots, index) =>
        index === dayIndex
          ? slots.filter(
              (_, itemIndex) => itemIndex !== slotIndex,
            )
          : slots,
      ),
    );
  }

  async function save() {
    setSaving(true);

    try {
      for (const hour of hours) {
        const payload = {
          profile_id: data.profile.id,
          professional_id: data.profile.id,
          day_of_week: hour.day_of_week,
          is_open: hour.is_open,
          active: hour.is_open,
          start_time: hour.is_open
            ? hour.start_time || null
            : null,
          end_time: hour.is_open
            ? hour.end_time || null
            : null,
        };

        const { error } = await supabase
          .from('business_hours')
          .upsert(payload, {
            onConflict: 'profile_id,day_of_week',
          });

        if (error) throw error;
      }

      const { error: deleteError } = await supabase
        .from('availability_slots')
        .delete()
        .eq('profile_id', data.profile.id);

      if (deleteError) throw deleteError;

      const rows = slotsByDay.flatMap(
        (slots, dayIndex) =>
          [...slots]
            .filter(Boolean)
            .sort()
            .map((time) => ({
              profile_id: data.profile.id,
              day_of_week: dayIndex,
              start_time: time,
              active: true,
            })),
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
        savedAvailability = inserted as typeof data.availability;
      }

      setData({
        ...data,
        hours: hours as typeof data.hours,
        availability: savedAvailability,
      });

      window.alert('Horários salvos com sucesso.');
    } catch (error) {
      console.error('ERRO AO SALVAR HORÁRIOS:', error);
      window.alert(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar os horários.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">
            Configure sua agenda
          </div>
          <h1>Horários</h1>
          <p>
            Defina quando você atende e quais horários suas clientes podem escolher.
          </p>
        </div>

        <Button onClick={save} disabled={saving}>
          <Check size={17} />
          {saving ? 'Salvando...' : 'Salvar horários'}
        </Button>
      </div>

      <section className="hours-card">
        {hours.map((hour, index) => (
          <div className="hours-row" key={index}>
            <div className="day-toggle">
              <button
                type="button"
                className={
                  hour.is_open ? 'toggle on' : 'toggle'
                }
                onClick={() =>
                  updateHour(index, {
                    is_open: !hour.is_open,
                  })
                }
              >
                <i />
              </button>

              <strong>{days[index]}</strong>
            </div>

            {hour.is_open ? (
              <div className="time-inputs">
                <input
                  type="time"
                  value={hour.start_time || ''}
                  onChange={(event) =>
                    updateHour(index, {
                      start_time: event.target.value,
                    })
                  }
                />

                <span>até</span>

                <input
                  type="time"
                  value={hour.end_time || ''}
                  onChange={(event) =>
                    updateHour(index, {
                      end_time: event.target.value,
                    })
                  }
                />
              </div>
            ) : (
              <span className="closed">Fechado</span>
            )}

            {hour.is_open && (
              <div
                style={{
                  gridColumn: '1 / -1',
                  marginTop: 8,
                  paddingLeft: 44,
                }}
              >
                <div
                  style={{
                    borderTop: '1px solid rgba(0,0,0,.08)',
                    paddingTop: 14,
                  }}
                >
                  <strong style={{ fontSize: 13 }}>
                    Horários disponíveis para clientes
                  </strong>
                  <p
                    style={{
                      margin: '4px 0 12px',
                      fontSize: 12,
                      opacity: 0.65,
                    }}
                  >
                    Adicione apenas os horários em que uma cliente pode começar um atendimento.
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    {slotsByDay[index].map((slot, slotIndex) => (
                      <div
                        key={`${index}-${slot}-${slotIndex}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '7px 9px 7px 11px',
                          border: '1px solid rgba(0,0,0,.10)',
                          borderRadius: 999,
                          background: 'rgba(0,0,0,.025)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {slot}
                        </span>
                        <button
                          type="button"
                          aria-label={`Remover horário ${slot}`}
                          onClick={() =>
                            removeSlot(index, slotIndex)
                          }
                          style={{
                            border: 0,
                            background: 'transparent',
                            padding: 2,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            opacity: 0.6,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                      }}
                    >
                      <input
                        type="time"
                        value={newSlotByDay[index]}
                        onChange={(event) =>
                          setNewSlotByDay((currentValues) =>
                            currentValues.map((time, itemIndex) =>
                              itemIndex === index
                                ? event.target.value
                                : time,
                            ),
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            addSlot(index);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="button button-soft"
                        onClick={() => addSlot(index)}
                      >
                        <Plus size={15} />
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {!slotsByDay[index].length && (
                    <span
                      className="closed"
                      style={{ display: 'block', marginTop: 10 }}
                    >
                      Nenhum horário adicionado ainda.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function Blocks({
  data,
  setData,
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

    const result = await supabase
      .from('blocked_times')
      .insert({
        ...form,
        profile_id: data.profile.id,
      })
      .select()
      .maybeSingle();

    if (!result.error && result.data) {
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
        --ui-ink: #101114;
        --ui-ink-soft: #555960;
        --ui-muted: #7b8088;
        --ui-line: rgba(16, 17, 20, .09);
        --ui-line-strong: rgba(16, 17, 20, .14);
        --ui-surface: rgba(255, 255, 255, .78);
        --ui-surface-solid: #ffffff;
        --ui-soft: #f5f6f8;
        --ui-soft-2: #eef0f3;
        --ui-shadow: 0 24px 70px rgba(16, 17, 20, .08);
        --ui-shadow-soft: 0 10px 35px rgba(16, 17, 20, .07);
        --ui-radius: 20px;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        background: #f7f7f6;
        color: var(--ui-ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      button, input, textarea { font: inherit; }
      button, a { -webkit-tap-highlight-color: transparent; }
      a { color: inherit; }

      @keyframes ui-fade-up {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes ui-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes ui-float {
        0%, 100% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -7px, 0); }
      }
      @keyframes ui-shine {
        from { transform: translateX(-130%) skewX(-18deg); }
        to { transform: translateX(180%) skewX(-18deg); }
      }
      @keyframes ui-pulse-ring {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16,17,20,.08); }
        50% { box-shadow: 0 0 0 8px rgba(16,17,20,0); }
      }

      .brand {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 9px;
        text-decoration: none;
        font-weight: 800;
        letter-spacing: -.045em;
        color: var(--ui-ink);
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 11px;
        background: #111214;
        color: white;
        box-shadow: 0 8px 20px rgba(0,0,0,.13);
      }
      .brand-dot { color: #8b9098; }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 10px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: .12em;
        text-transform: uppercase;
        color: #747981;
      }
      .eyebrow::before {
        content: "";
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: currentColor;
        opacity: .65;
      }

      .button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 9px;
        min-height: 46px;
        padding: 0 17px;
        border: 1px solid transparent;
        border-radius: 13px;
        font-weight: 750;
        font-size: 13px;
        letter-spacing: -.01em;
        cursor: pointer;
        text-decoration: none;
        overflow: hidden;
        transition: transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease, background .22s ease, border-color .22s ease;
      }
      .button::after {
        content: "";
        position: absolute;
        inset: 0 auto 0 -45%;
        width: 25%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.32), transparent);
        transform: skewX(-18deg);
        pointer-events: none;
      }
      .button:hover::after { animation: ui-shine .75s ease; }
      .button:hover { transform: translateY(-2px); }
      .button:active { transform: translateY(0) scale(.985); }
      .button:disabled { opacity: .52; cursor: not-allowed; transform: none; }
      .button-primary {
        color: #fff;
        background: #111214;
        box-shadow: 0 12px 28px rgba(17,18,20,.16);
      }
      .button-primary:hover { box-shadow: 0 17px 36px rgba(17,18,20,.21); }
      .button-soft {
        color: var(--ui-ink);
        background: rgba(255,255,255,.72);
        border-color: var(--ui-line-strong);
        box-shadow: 0 8px 24px rgba(16,17,20,.05);
      }
      .button-ghost {
        color: var(--ui-ink-soft);
        background: transparent;
        border-color: transparent;
      }
      .button-danger { color: #9a2525; background: #fff5f5; border-color: rgba(154,37,37,.12); }
      .button-dark { color: #fff; background: #111214; }

      .icon-button {
        display: grid;
        place-items: center;
        width: 38px;
        height: 38px;
        padding: 0;
        border: 1px solid var(--ui-line);
        border-radius: 12px;
        background: rgba(255,255,255,.72);
        color: var(--ui-ink);
        cursor: pointer;
        transition: transform .2s ease, background .2s ease, box-shadow .2s ease;
      }
      .icon-button:hover { transform: translateY(-2px); background: #fff; box-shadow: var(--ui-shadow-soft); }
      .icon-button:active { transform: scale(.96); }

      .field { gap: 8px; }
      .field > span { font-size: 11px; font-weight: 750; color: #4e535b; }
      .field input, .field textarea {
        border: 1px solid var(--ui-line-strong) !important;
        border-radius: 13px !important;
        background: rgba(255,255,255,.82) !important;
        color: var(--ui-ink) !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 5px 18px rgba(16,17,20,.025);
        transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
      }
      .field input:focus, .field textarea:focus {
        outline: none;
        border-color: rgba(16,17,20,.34) !important;
        box-shadow: 0 0 0 4px rgba(16,17,20,.055), 0 8px 25px rgba(16,17,20,.06);
      }

      .center-page {
        min-height: 100vh;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 12px;
        padding: 28px;
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(circle at 20% 20%, rgba(255,255,255,.96), transparent 34%),
          radial-gradient(circle at 80% 10%, rgba(229,232,236,.75), transparent 30%),
          #f6f6f5;
      }
      .center-page::before {
        content: "";
        position: absolute;
        width: 420px;
        height: 420px;
        border-radius: 50%;
        border: 1px solid rgba(16,17,20,.06);
        box-shadow: 0 0 0 70px rgba(16,17,20,.018), 0 0 0 140px rgba(16,17,20,.012);
        animation: ui-float 7s ease-in-out infinite;
      }
      .center-page > * { position: relative; z-index: 1; }

      .panel {
        border: 1px solid var(--ui-line);
        border-radius: 24px;
        background: rgba(255,255,255,.82);
        box-shadow: var(--ui-shadow);
        backdrop-filter: blur(24px);
      }
      .panel.centered { max-width: 520px; padding: 34px; text-align: center; }
      .panel.centered h1 { margin: 10px 0 9px; letter-spacing: -.04em; }
      .panel.centered p { color: var(--ui-ink-soft); line-height: 1.65; }

      /* HOME */
      .home-page {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        padding: 30px clamp(22px, 5vw, 72px);
        background:
          radial-gradient(circle at 75% 18%, rgba(220,224,229,.8), transparent 25%),
          radial-gradient(circle at 15% 80%, rgba(235,236,238,.8), transparent 26%),
          linear-gradient(135deg, #fff 0%, #fafafa 54%, #f1f2f3 100%);
      }
      .home-page::before {
        content: "";
        position: absolute;
        width: 54vw;
        height: 54vw;
        right: -18vw;
        top: -23vw;
        border: 1px solid rgba(16,17,20,.08);
        border-radius: 50%;
        box-shadow: 0 0 0 55px rgba(16,17,20,.015), 0 0 0 110px rgba(16,17,20,.012);
        animation: ui-float 10s ease-in-out infinite;
      }
      .home-page::after {
        content: "";
        position: absolute;
        width: 280px;
        height: 280px;
        left: -130px;
        bottom: -120px;
        border-radius: 50%;
        background: rgba(255,255,255,.75);
        filter: blur(5px);
        box-shadow: 0 0 80px rgba(255,255,255,.95);
      }
      .home-page > * { position: relative; z-index: 1; }
      .home-page > .brand { animation: ui-fade-up .7s ease both; }
      .home-copy {
        width: min(820px, 100%);
        margin: auto 0;
        padding: 10vh 0 12vh;
        animation: ui-fade-up .8s .08s ease both;
      }
      .home-copy h1 {
        max-width: 760px;
        margin: 20px 0 18px;
        font-size: clamp(44px, 7vw, 86px);
        line-height: .96;
        letter-spacing: -.075em;
      }
      .home-copy p {
        max-width: 590px;
        margin: 0;
        font-size: clamp(15px, 1.6vw, 19px);
        line-height: 1.65;
        color: #62676e;
      }
      .home-actions { display: flex; align-items: center; gap: 14px; margin-top: 30px; flex-wrap: wrap; }
      .home-note {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        align-self: flex-start;
        padding: 10px 13px;
        border: 1px solid var(--ui-line);
        border-radius: 999px;
        background: rgba(255,255,255,.58);
        color: #666b72;
        font-size: 11px;
        backdrop-filter: blur(15px);
        animation: ui-fade-in .8s .25s ease both;
      }

      /* AUTH */
      .auth-page {
        position: relative;
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(380px, .92fr);
        overflow: hidden;
        background: #f7f7f6;
      }
      .auth-page::before {
        content: "";
        position: absolute;
        width: 680px;
        height: 680px;
        left: -280px;
        bottom: -340px;
        border: 1px solid rgba(16,17,20,.07);
        border-radius: 50%;
        box-shadow: 0 0 0 90px rgba(16,17,20,.012), 0 0 0 180px rgba(16,17,20,.01);
      }
      .auth-aside {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 100vh;
        padding: clamp(28px, 5vw, 72px);
        overflow: hidden;
        background:
          radial-gradient(circle at 70% 25%, rgba(219,223,228,.9), transparent 26%),
          radial-gradient(circle at 20% 80%, rgba(255,255,255,.95), transparent 34%),
          linear-gradient(145deg, #fff 0%, #f4f5f6 100%);
        border-right: 1px solid var(--ui-line);
      }
      .auth-aside::after {
        content: "";
        position: absolute;
        width: 520px;
        height: 520px;
        right: -220px;
        top: 20%;
        border-radius: 50%;
        border: 1px solid rgba(16,17,20,.08);
        box-shadow: 0 0 0 55px rgba(16,17,20,.015), 0 0 0 110px rgba(16,17,20,.01);
        animation: ui-float 9s ease-in-out infinite;
      }
      .auth-aside > * { position: relative; z-index: 1; }
      .auth-aside > div:nth-child(2) { max-width: 660px; animation: ui-fade-up .8s ease both; }
      .auth-aside h1 {
        margin: 22px 0 18px;
        max-width: 640px;
        font-size: clamp(44px, 6vw, 76px);
        line-height: .96;
        letter-spacing: -.07em;
      }
      .auth-aside p { max-width: 540px; margin: 0; color: #646970; line-height: 1.7; font-size: 16px; }
      .aside-note { color: #81858b; font-size: 11px; font-weight: 650; }
      .auth-card {
        position: relative;
        z-index: 2;
        align-self: center;
        width: min(500px, calc(100% - 48px));
        margin: 48px auto;
        padding: clamp(30px, 5vw, 48px);
        border: 1px solid rgba(16,17,20,.09);
        border-radius: 28px;
        background: rgba(255,255,255,.82);
        box-shadow: 0 35px 90px rgba(16,17,20,.1);
        backdrop-filter: blur(30px);
        animation: ui-fade-up .8s .08s ease both;
      }
      .mobile-brand { display: none; margin-bottom: 30px; }
      .auth-card h2 { margin: 18px 0 8px; font-size: 36px; letter-spacing: -.055em; }
      .auth-lead { margin: 0 0 28px; color: #73777e; line-height: 1.55; }
      .auth-card form { display: grid; gap: 16px; }
      .auth-card form .button { width: 100%; margin-top: 4px; }
      .switch-auth { margin: 22px 0 0; text-align: center; color: #7a7f86; font-size: 12px; }
      .switch-auth button { margin-left: 5px; border: 0; background: none; font-weight: 800; cursor: pointer; color: var(--ui-ink); }
      .switch-auth button:hover { text-decoration: underline; }
      .form-error, .saved { border-radius: 13px; padding: 12px 13px; font-size: 12px; line-height: 1.5; }
      .form-error { color: #8f2525; background: #fff3f3; border: 1px solid rgba(143,37,37,.1); }
      .saved { color: #27633d; background: #f1faf4; border: 1px solid rgba(39,99,61,.1); }

      /* PUBLIC */
      .public-shell {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background:
          radial-gradient(circle at 78% 12%, color-mix(in srgb, var(--profile-primary, #111) 8%, white), transparent 28%),
          radial-gradient(circle at 8% 36%, rgba(229,232,236,.65), transparent 24%),
          #fafaf9;
      }
      .public-shell::before {
        content: "";
        position: absolute;
        width: 620px;
        height: 620px;
        right: -280px;
        top: 80px;
        border-radius: 50%;
        border: 1px solid rgba(16,17,20,.055);
        box-shadow: 0 0 0 80px rgba(16,17,20,.012), 0 0 0 160px rgba(16,17,20,.008);
        animation: ui-float 11s ease-in-out infinite;
        pointer-events: none;
      }
      .public-nav {
        position: sticky;
        top: 14px;
        z-index: 40;
        width: min(1180px, calc(100% - 32px));
        margin: 14px auto 0;
        min-height: 62px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 9px 10px 9px 15px;
        border: 1px solid rgba(16,17,20,.08);
        border-radius: 18px;
        background: rgba(255,255,255,.7);
        box-shadow: 0 15px 45px rgba(16,17,20,.07);
        backdrop-filter: blur(22px) saturate(1.2);
      }
      .public-links { display: flex; align-items: center; gap: 5px; }
      .public-links a {
        padding: 10px 12px;
        border-radius: 10px;
        text-decoration: none;
        color: #6a6f76;
        font-size: 12px;
        font-weight: 700;
        transition: color .2s ease, background .2s ease, transform .2s ease;
      }
      .public-links a:hover { color: var(--ui-ink); background: rgba(16,17,20,.045); transform: translateY(-1px); }
      .menu-button { display: none; }
      .profile-hero {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100% - 32px));
        min-height: 650px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: minmax(250px, .82fr) minmax(0, 1.18fr);
        align-items: center;
        gap: clamp(36px, 7vw, 100px);
        padding: clamp(70px, 10vw, 130px) 0 95px;
      }
      .profile-image {
        position: relative;
        display: grid;
        place-items: center;
        min-height: 430px;
      }
      .profile-image::before {
        content: "";
        position: absolute;
        width: min(390px, 80vw);
        aspect-ratio: 1;
        border-radius: 44% 56% 50% 50%;
        background: linear-gradient(145deg, rgba(255,255,255,.9), rgba(229,232,235,.65));
        border: 1px solid rgba(16,17,20,.06);
        box-shadow: 30px 35px 80px rgba(16,17,20,.08), inset 0 1px 0 rgba(255,255,255,.95);
        transform: rotate(-7deg);
      }
      .profile-image::after {
        content: "";
        position: absolute;
        width: 65%;
        aspect-ratio: 1;
        border-radius: 50%;
        border: 1px solid rgba(16,17,20,.07);
        box-shadow: 0 0 0 24px rgba(16,17,20,.012);
        animation: ui-pulse-ring 4s ease-in-out infinite;
      }
      .profile-image .avatar { position: relative; z-index: 2; box-shadow: 0 25px 70px rgba(16,17,20,.16); border: 7px solid rgba(255,255,255,.86); }
      .profile-content { max-width: 690px; animation: ui-fade-up .8s .12s ease both; }
      .profile-content h1 {
        margin: 20px 0 8px;
        font-size: clamp(50px, 7vw, 92px);
        line-height: .91;
        letter-spacing: -.075em;
        max-width: 760px;
      }
      .profile-specialty { margin: 0; font-size: 16px; font-weight: 750; color: #4e535a; }
      .profile-description { max-width: 620px; margin: 22px 0 0; color: #73777d; line-height: 1.7; }
      .profile-facts { display: flex; flex-wrap: wrap; gap: 8px; margin: 26px 0 30px; }
      .profile-facts span {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 9px 11px;
        border: 1px solid var(--ui-line);
        border-radius: 999px;
        background: rgba(255,255,255,.62);
        color: #666b72;
        font-size: 11px;
        backdrop-filter: blur(12px);
      }
      .profile-content .button { min-width: 155px; }
      .public-section, .location-section, .contact-strip, .public-shell footer {
        position: relative;
        z-index: 1;
        width: min(1180px, calc(100% - 32px));
        margin-left: auto;
        margin-right: auto;
      }
      .public-section { padding: 70px 0 100px; }
      .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 28px; }
      .section-heading h2, .contact-strip h2, .location-section h2 { margin: 10px 0 0; font-size: clamp(32px, 4vw, 48px); letter-spacing: -.06em; }
      .section-heading > span { color: #898e95; font-size: 11px; font-weight: 700; }
      .service-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
      .service-card {
        position: relative;
        min-height: 180px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 24px;
        padding: 24px;
        border: 1px solid rgba(16,17,20,.08);
        border-radius: 19px;
        background: rgba(255,255,255,.7);
        text-align: left;
        cursor: pointer;
        overflow: hidden;
        box-shadow: 0 12px 35px rgba(16,17,20,.045);
        transition: transform .28s cubic-bezier(.2,.8,.2,1), border-color .25s ease, box-shadow .28s ease, background .25s ease;
      }
      .service-card::before {
        content: "";
        position: absolute;
        width: 170px;
        height: 170px;
        right: -70px;
        top: -80px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--profile-primary, #111) 8%, white);
        filter: blur(3px);
      }
      .service-card:hover { transform: translateY(-5px); border-color: rgba(16,17,20,.15); box-shadow: 0 22px 50px rgba(16,17,20,.09); background: rgba(255,255,255,.9); }
      .service-card:active { transform: translateY(-1px) scale(.995); }
      .service-card h3 { position: relative; z-index: 1; margin: 0 0 8px; font-size: 19px; letter-spacing: -.035em; }
      .service-card p { position: relative; z-index: 1; max-width: 390px; margin: 0 0 16px; color: #777c83; font-size: 12px; line-height: 1.55; }
      .service-card strong { position: relative; z-index: 1; white-space: nowrap; font-size: 17px; letter-spacing: -.025em; }
      .service-duration { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 6px; color: #81868d; font-size: 10px; font-weight: 700; }
      .contact-strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 30px;
        margin-top: 10px;
        padding: 34px;
        border: 1px solid rgba(16,17,20,.08);
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(255,255,255,.9), rgba(241,242,244,.75));
        box-shadow: var(--ui-shadow-soft);
        overflow: hidden;
      }
      .contact-strip::after { content: ""; position: absolute; width: 260px; height: 260px; right: -100px; top: -130px; border-radius: 50%; border: 1px solid rgba(16,17,20,.06); }
      .contact-strip p, .location-section p { margin: 9px 0 0; color: #767b82; line-height: 1.6; font-size: 13px; }
      .location-section { display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 100px 0 120px; }
      .location-section > div { max-width: 650px; }
      .location-section .text-link { margin-bottom: 4px; }
      .text-link { display: inline-flex; align-items: center; gap: 6px; color: #5d6269; font-size: 12px; font-weight: 750; text-decoration: none; transition: color .2s ease, transform .2s ease; }
      .text-link:hover { color: var(--ui-ink); transform: translateX(2px); }
      .public-shell footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        padding: 28px 0 34px;
        border-top: 1px solid var(--ui-line);
        color: #858a91;
        font-size: 10px;
      }
      .public-shell footer a { display: inline-flex; align-items: center; gap: 5px; text-decoration: none; color: #5c6168; font-weight: 750; }

      /* BOOKING */
      .booking-overlay {
        position: fixed !important;
        inset: 0 !important;
        z-index: 100 !important;
        display: flex !important;
        align-items: flex-end !important;
        justify-content: center !important;
        padding: 18px !important;
        background: rgba(15,16,18,.28) !important;
        backdrop-filter: blur(12px);
        animation: ui-fade-in .22s ease both;
      }
      .booking-panel {
        width: min(720px, 100%);
        max-height: min(900px, calc(100vh - 36px));
        overflow: auto;
        border: 1px solid rgba(255,255,255,.7) !important;
        border-radius: 27px !important;
        background: rgba(255,255,255,.93) !important;
        box-shadow: 0 35px 110px rgba(0,0,0,.22) !important;
        backdrop-filter: blur(28px) saturate(1.2);
        animation: ui-fade-up .32s cubic-bezier(.2,.8,.2,1) both;
      }
      .booking-top {
        position: sticky;
        top: 0;
        z-index: 2;
        display: grid !important;
        grid-template-columns: 38px 1fr auto;
        align-items: center;
        gap: 13px;
        padding: 16px 18px !important;
        border-bottom: 1px solid var(--ui-line) !important;
        background: rgba(255,255,255,.82) !important;
        backdrop-filter: blur(18px);
      }
      .booking-top > div:nth-child(2) span { display: block; font-weight: 800; font-size: 13px; letter-spacing: -.02em; }
      .booking-top > div:nth-child(2) small { display: block; margin-top: 3px; color: #8a8f96; font-size: 10px; }
      .step-dots { display: flex; gap: 5px; }
      .step-dots i { display: block; width: 22px; height: 4px; border-radius: 999px; background: #e3e5e8; transition: width .25s ease, background .25s ease; }
      .step-dots i.active { width: 30px; background: var(--profile-primary, #111214); }
      .booking-content { padding: 28px !important; }
      .booking-heading h2 { margin: 10px 0 8px; font-size: 31px; letter-spacing: -.055em; }
      .booking-heading p { color: #777c83; font-size: 12px; line-height: 1.55; }
      .selected-service, .summary-mini {
        border: 1px solid var(--ui-line);
        border-radius: 16px;
        background: linear-gradient(135deg, #fff, #f5f6f7);
        box-shadow: 0 10px 28px rgba(16,17,20,.045);
      }
      .selected-service { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 16px; margin: 20px 0; }
      .selected-service strong { display: block; font-size: 14px; }
      .selected-service span { display: block; margin-top: 4px; color: #80858c; font-size: 10px; }
      .selected-service button { border: 0; background: none; color: #5f646b; font-weight: 750; cursor: pointer; font-size: 11px; }
      .date-grid { display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 7px; margin: 22px 0 28px; }
      .date-grid button {
        min-height: 82px;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 3px;
        padding: 8px 5px;
        border: 1px solid var(--ui-line);
        border-radius: 14px;
        background: rgba(255,255,255,.75);
        cursor: pointer;
        color: #777c83;
        transition: transform .22s ease, border-color .22s ease, background .22s ease, box-shadow .22s ease;
      }
      .date-grid button:hover { transform: translateY(-3px); border-color: rgba(16,17,20,.16); box-shadow: var(--ui-shadow-soft); }
      .date-grid button.selected { color: #fff; border-color: var(--profile-primary, #111); background: var(--profile-primary, #111); box-shadow: 0 12px 28px color-mix(in srgb, var(--profile-primary, #111) 20%, transparent); transform: translateY(-3px); }
      .date-grid button small { font-size: 9px; text-transform: capitalize; }
      .date-grid button strong { font-size: 22px; letter-spacing: -.06em; }
      .date-grid button span { font-size: 9px; }
      .slot-area { margin: 0 0 25px; padding: 18px; border: 1px solid var(--ui-line); border-radius: 18px; background: #fafafa; }
      .slot-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin-top: 12px; }
      .slot-grid button {
        min-height: 45px;
        border: 1px solid var(--ui-line-strong);
        border-radius: 12px;
        background: #fff;
        color: #34383d;
        font-weight: 750;
        font-size: 12px;
        cursor: pointer;
        transition: transform .18s ease, border-color .18s ease, background .18s ease, color .18s ease, box-shadow .18s ease;
      }
      .slot-grid button:hover { transform: translateY(-2px); box-shadow: 0 9px 20px rgba(16,17,20,.07); }
      .slot-grid button.selected { color: #fff; border-color: var(--profile-primary, #111); background: var(--profile-primary, #111); box-shadow: 0 10px 24px color-mix(in srgb, var(--profile-primary, #111) 20%, transparent); }
      .back-link { display: inline-flex; align-items: center; gap: 3px; border: 0; background: none; padding: 0; color: #70757c; font-size: 11px; font-weight: 750; cursor: pointer; }
      .summary-mini { display: grid; gap: 4px; margin: 20px 0; padding: 16px; }
      .summary-mini span { color: #8a8f96; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
      .summary-mini strong { font-size: 14px; }
      .summary-mini p { margin: 0; color: #73787f; font-size: 11px; }
      .summary-mini b { margin-top: 5px; font-size: 14px; }
      .confirmation { position: relative; z-index: 1; width: min(720px, calc(100% - 32px)); min-height: calc(100vh - 100px); margin: 0 auto; display: grid; place-items: center; align-content: center; text-align: center; padding: 80px 0; animation: ui-fade-up .7s ease both; }
      .success-mark { width: 76px; height: 76px; display: grid; place-items: center; margin-bottom: 22px; border-radius: 24px; color: #fff; background: #111214; box-shadow: 0 22px 50px rgba(16,17,20,.17); animation: ui-float 5s ease-in-out infinite; }
      .confirmation h1 { margin: 15px 0 10px; font-size: clamp(40px, 6vw, 65px); line-height: .95; letter-spacing: -.07em; }
      .confirmation > p { margin: 0; color: #73787f; line-height: 1.6; }
      .booking-receipt { width: min(500px, 100%); margin: 30px 0 22px; display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; overflow: hidden; border: 1px solid var(--ui-line); border-radius: 18px; background: var(--ui-line); box-shadow: var(--ui-shadow-soft); }
      .booking-receipt > div { padding: 18px 13px; background: rgba(255,255,255,.9); }
      .booking-receipt span { display: block; margin-bottom: 6px; color: #858a91; font-size: 9px; font-weight: 800; text-transform: uppercase; }
      .booking-receipt strong { font-size: 12px; }

      /* DASHBOARD */
      .dashboard-shell { position: relative; min-height: 100vh; display: grid; grid-template-columns: 245px minmax(0,1fr); background: #f7f7f6; overflow: hidden; }
      .dashboard-shell::before { content: ""; position: absolute; width: 650px; height: 650px; right: -280px; top: -280px; border-radius: 50%; border: 1px solid rgba(16,17,20,.055); box-shadow: 0 0 0 80px rgba(16,17,20,.01); pointer-events: none; }
      .sidebar {
        position: relative;
        z-index: 10;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        padding: 20px 14px;
        border-right: 1px solid var(--ui-line);
        background: rgba(255,255,255,.7);
        backdrop-filter: blur(24px);
      }
      .sidebar-top { display: flex; align-items: center; justify-content: space-between; padding: 0 7px 22px; }
      .sidebar-top .icon-button { display: none; }
      .side-profile { display: flex; align-items: center; gap: 10px; padding: 13px 9px; margin-bottom: 14px; border: 1px solid var(--ui-line); border-radius: 15px; background: rgba(255,255,255,.65); }
      .side-profile strong { display: block; max-width: 135px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
      .side-profile span { display: block; max-width: 135px; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #898e95; font-size: 9px; }
      .sidebar nav { display: grid; gap: 4px; }
      .sidebar nav a { position: relative; display: flex; align-items: center; gap: 10px; padding: 11px 11px; border-radius: 11px; text-decoration: none; color: #777c83; font-size: 11px; font-weight: 700; transition: color .2s ease, background .2s ease, transform .2s ease; }
      .sidebar nav a:hover { color: var(--ui-ink); background: rgba(16,17,20,.04); transform: translateX(2px); }
      .sidebar nav a.active { color: var(--ui-ink); background: rgba(16,17,20,.065); }
      .sidebar nav a.active::before { content: ""; position: absolute; left: -14px; width: 3px; height: 20px; border-radius: 0 999px 999px 0; background: #111214; }
      .logout { margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 11px; border: 0; border-radius: 11px; background: transparent; color: #858a91; font-size: 11px; font-weight: 700; cursor: pointer; }
      .logout:hover { color: #a32929; background: #fff5f5; }
      .dashboard-main { position: relative; z-index: 1; min-width: 0; }
      .dashboard-top { position: sticky; top: 0; z-index: 20; min-height: 74px; display: flex; align-items: center; gap: 13px; padding: 12px clamp(18px, 3vw, 40px); border-bottom: 1px solid var(--ui-line); background: rgba(247,247,246,.72); backdrop-filter: blur(20px); }
      .dashboard-top > div:nth-child(2) { display: grid; gap: 3px; }
      .top-kicker { color: #8a8f96; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; }
      .dashboard-top strong { font-size: 13px; letter-spacing: -.02em; }
      .public-link { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid var(--ui-line); border-radius: 11px; background: rgba(255,255,255,.68); text-decoration: none; color: #5f646b; font-size: 10px; font-weight: 750; transition: transform .2s ease, box-shadow .2s ease, background .2s ease; }
      .public-link:hover { transform: translateY(-2px); background: #fff; box-shadow: var(--ui-shadow-soft); }
      .mobile-only { display: none; }
      .dashboard-content { width: min(1180px, calc(100% - 48px)); margin: 0 auto; padding: 45px 0 80px; animation: ui-fade-up .55s ease both; }
      .dashboard-content > * > h1 { margin: 0 0 7px; font-size: clamp(34px, 4vw, 52px); line-height: .98; letter-spacing: -.065em; }
      .dashboard-content > * > h1 + p { margin: 0 0 28px; color: #7c8188; font-size: 12px; line-height: 1.55; }
      .dashboard-content .panel, .dashboard-content .table-wrap, .dashboard-content .settings-card, .dashboard-content .link-card { border-color: var(--ui-line) !important; border-radius: 20px !important; background: rgba(255,255,255,.74) !important; box-shadow: var(--ui-shadow-soft) !important; backdrop-filter: blur(18px); }
      .dashboard-content .panel:hover, .dashboard-content .link-card:hover { border-color: rgba(16,17,20,.13) !important; }
      .dashboard-content .stats, .dashboard-content .stat-grid { gap: 10px !important; }
      .dashboard-content .stat-card { position: relative; overflow: hidden; border: 1px solid var(--ui-line) !important; border-radius: 18px !important; background: rgba(255,255,255,.75) !important; box-shadow: var(--ui-shadow-soft) !important; transition: transform .25s ease, box-shadow .25s ease; }
      .dashboard-content .stat-card::after { content: ""; position: absolute; width: 130px; height: 130px; right: -55px; top: -70px; border-radius: 50%; background: rgba(16,17,20,.035); }
      .dashboard-content .stat-card:hover { transform: translateY(-4px); box-shadow: 0 20px 45px rgba(16,17,20,.09) !important; }
      .dashboard-content .appointment-card, .dashboard-content .service-row, .dashboard-content .block-row, .dashboard-content .hour-row { border-color: var(--ui-line) !important; background: rgba(255,255,255,.72) !important; border-radius: 16px !important; transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease; }
      .dashboard-content .appointment-card:hover, .dashboard-content .service-row:hover, .dashboard-content .block-row:hover, .dashboard-content .hour-row:hover { transform: translateY(-2px); border-color: rgba(16,17,20,.14) !important; box-shadow: 0 12px 30px rgba(16,17,20,.055); }
      .empty { border: 1px dashed rgba(16,17,20,.14) !important; border-radius: 19px !important; background: rgba(255,255,255,.55) !important; }
      .empty-icon { animation: ui-float 5s ease-in-out infinite; }
      .media-upload img, .media-upload .avatar { box-shadow: 0 15px 35px rgba(16,17,20,.09); }
      .copy-field { border-radius: 13px !important; border-color: var(--ui-line-strong) !important; background: #fff !important; }

      /* subtle reveal for major sections */
      .public-section, .contact-strip, .location-section, .dashboard-content > * > * { animation: ui-fade-up .65s ease both; }

      @media (max-width: 900px) {
        .auth-page { grid-template-columns: 1fr; }
        .auth-aside { min-height: 310px; padding: 28px 24px; }
        .auth-aside h1 { font-size: clamp(40px, 11vw, 62px); }
        .auth-aside p, .aside-note { display: none; }
        .auth-card { margin: -55px auto 28px; }
        .mobile-brand { display: block; }
        .profile-hero { grid-template-columns: 1fr; gap: 20px; min-height: auto; padding-top: 75px; text-align: center; }
        .profile-image { min-height: 300px; }
        .profile-content { margin: 0 auto; }
        .profile-content h1 { font-size: clamp(48px, 13vw, 76px); }
        .profile-facts { justify-content: center; }
        .service-list { grid-template-columns: 1fr; }
        .dashboard-shell { grid-template-columns: 1fr; }
        .sidebar { position: fixed; inset: 0 auto 0 0; width: min(290px, 86vw); transform: translateX(-102%); transition: transform .3s cubic-bezier(.2,.8,.2,1); box-shadow: 30px 0 80px rgba(16,17,20,.12); }
        .sidebar.open { transform: translateX(0); }
        .sidebar-top .icon-button { display: grid; }
        .mobile-only { display: grid; }
      }

      @media (max-width: 640px) {
        .home-page { padding: 22px 18px; }
        .home-copy { padding: 12vh 0 10vh; }
        .home-copy h1 { font-size: clamp(43px, 14vw, 64px); }
        .home-actions { align-items: stretch; flex-direction: column; }
        .home-actions .button { width: 100%; }
        .auth-aside { min-height: 270px; }
        .auth-card { width: calc(100% - 28px); padding: 27px 20px; margin-top: -45px; border-radius: 22px; }
        .auth-card h2 { font-size: 31px; }
        .public-nav { width: calc(100% - 20px); margin-top: 10px; border-radius: 15px; }
        .public-links { position: absolute; top: 69px; left: 0; right: 0; display: grid; gap: 3px; padding: 8px; border: 1px solid var(--ui-line); border-radius: 15px; background: rgba(255,255,255,.9); box-shadow: var(--ui-shadow); backdrop-filter: blur(22px); opacity: 0; pointer-events: none; transform: translateY(-7px); transition: opacity .22s ease, transform .22s ease; }
        .public-links.open { opacity: 1; pointer-events: auto; transform: translateY(0); }
        .menu-button { display: grid; }
        .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width: calc(100% - 24px); }
        .profile-hero { padding-top: 55px; padding-bottom: 60px; }
        .profile-image { min-height: 245px; }
        .profile-image::before { width: 270px; }
        .profile-content h1 { font-size: clamp(45px, 14vw, 62px); }
        .profile-facts { align-items: center; flex-direction: column; }
        .profile-facts span { max-width: 100%; }
        .public-section { padding: 55px 0 65px; }
        .section-heading { align-items: flex-start; flex-direction: column; }
        .service-card { min-height: 155px; padding: 19px; }
        .contact-strip, .location-section { align-items: flex-start; flex-direction: column; padding: 25px 20px; }
        .location-section { padding: 65px 0; border-radius: 0; border-top: 1px solid var(--ui-line); }
        .public-shell footer { align-items: flex-start; flex-direction: column; }
        .booking-overlay { padding: 8px !important; }
        .booking-panel { max-height: calc(100vh - 16px); border-radius: 23px !important; }
        .booking-content { padding: 22px 18px !important; }
        .booking-heading h2 { font-size: 28px; }
        .date-grid { grid-template-columns: repeat(4, minmax(0,1fr)); }
        .slot-grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        .booking-receipt { grid-template-columns: 1fr; }
        .booking-receipt > div { text-align: left; }
        .dashboard-top { padding: 11px 15px; }
        .public-link { font-size: 0; width: 38px; padding: 0; justify-content: center; }
        .dashboard-content { width: calc(100% - 28px); padding-top: 32px; }
        .dashboard-content > * > h1 { font-size: 39px; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
      }
    `}</style>
  );
}

function App() {
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

  if (
    path === '/login' ||
    path === '/cadastro'
  ) {
    return <AuthPage />;
  }

  if (path.startsWith('/dashboard')) {
    return session ? (
      <Dashboard userId={session.user.id} />
    ) : (
      <AuthPage />
    );
  }

  return (
    <div className="home-page">
      <Brand />

      <div className="home-copy">
        <div className="eyebrow">
          Agenda simples para quem faz acontecer
        </div>

        <h1>
          Seu trabalho merece uma agenda que acompanhe
          seu ritmo.
        </h1>

        <p>
          Um link bonito para suas clientes conhecerem
          seus serviços e agendarem sem trocar dezenas
          de mensagens.
        </p>

        <div className="home-actions">
          <a
            className="button button-primary"
            href="/cadastro"
          >
            Criar minha página{' '}
            <ArrowRight size={17} />
          </a>

          <a className="text-link" href="/login">
            Já tenho uma conta
          </a>
        </div>
      </div>

      <div className="home-note">
        <Check size={16} />
        Sem mensalidade escondida no começo
      </div>
    </div>
  );
}

export default App;