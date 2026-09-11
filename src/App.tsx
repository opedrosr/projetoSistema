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
        .map((slot) => slot.start_time.slice(0, 5)),
    ),
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
    const current = slotsByDay[dayIndex];
    const fallback =
      hours[dayIndex].start_time || '09:00';

    if (current.includes(fallback)) {
      return;
    }

    setSlotsByDay((currentDays) =>
      currentDays.map((slots, index) =>
        index === dayIndex
          ? [...slots, fallback].sort()
          : slots,
      ),
    );
  }

  function updateSlot(
    dayIndex: number,
    slotIndex: number,
    value: string,
  ) {
    setSlotsByDay((currentDays) =>
      currentDays.map((slots, index) =>
        index === dayIndex
          ? slots
              .map((slot, itemIndex) =>
                itemIndex === slotIndex ? value : slot,
              )
              .filter(Boolean)
              .sort()
          : slots,
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
          slots
            .filter((time) => time)
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
            Você define quando atende e quais horários suas clientes podem escolher.
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 8,
                  paddingLeft: 44,
                }}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>
                    Horários que a cliente pode escolher
                  </strong>
                  <p
                    style={{
                      margin: '4px 0 10px',
                      fontSize: 12,
                      opacity: 0.65,
                    }}
                  >
                    Cadastre os horários de início. A duração do serviço será aplicada automaticamente.
                  </p>
                </div>

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
                      key={`${index}-${slotIndex}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <input
                        type="time"
                        value={slot}
                        onChange={(event) =>
                          updateSlot(
                            index,
                            slotIndex,
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Remover horário"
                        onClick={() =>
                          removeSlot(index, slotIndex)
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="button button-soft"
                    onClick={() => addSlot(index)}
                  >
                    <Plus size={15} />
                    Adicionar horário
                  </button>
                </div>

                {!slotsByDay[index].length && (
                  <span className="closed">
                    Nenhum horário de agendamento configurado.
                  </span>
                )}
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

function App() {
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