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
  Moon,
  Sun,
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

function Dashboard({ userId, onToggleTheme, theme }: { userId: string; onToggleTheme: () => void; theme: 'light' | 'dark' }) {
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
  return <DashboardLayout data={data} setData={setData} onToggleTheme={onToggleTheme} theme={theme} />;
}

function DashboardLayout({
  data,
  setData,
  onToggleTheme,
  theme,
}: {
  data: NonNullable<OwnerData>;
  setData: React.Dispatch<
    React.SetStateAction<OwnerData | undefined>
  >;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
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

          <button
            type="button"
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
            title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span className="theme-toggle-label">{theme === 'light' ? 'Modo escuro' : 'Modo claro'}</span>
          </button>

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
  onCancel?: () => void | Promise<void>;
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
  setData
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
  setData
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
  setData
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
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background: #f5f5f4;
        color: var(--ui-ink);
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
      .home-page { min-height:100vh; position:relative; overflow:hidden; display:flex; flex-direction:column; padding:24px clamp(20px,4vw,56px); background:radial-gradient(circle at 82% 20%,#e9ebed,transparent 24%),linear-gradient(135deg,#fff 0%,#fafafa 58%,#f0f1f2 100%); }
      .home-page::before { content:""; position:absolute; width:50vw; height:50vw; right:-22vw; top:-25vw; border:1px solid rgba(17,18,20,.07); border-radius:50%; box-shadow:0 0 0 45px rgba(17,18,20,.012),0 0 0 90px rgba(17,18,20,.008); }
      .home-page > * { position:relative; z-index:1; }
      .home-copy { width:min(760px,100%); margin:auto 0; padding:8vh 0 9vh; animation:ui-in .6s ease both; }
      .home-copy h1 { max-width:700px; margin:15px 0 13px; font-size:clamp(42px,6.5vw,78px); line-height:.96; letter-spacing:-.075em; }
      .home-copy p { max-width:540px; margin:0; color:#656a71; font-size:15px; line-height:1.6; }
      .home-actions { display:flex; gap:9px; align-items:center; flex-wrap:wrap; margin-top:23px; }
      .home-note { display:inline-flex; align-items:center; gap:7px; width:max-content; padding:8px 11px; border:1px solid var(--ui-line); border-radius:999px; background:rgba(255,255,255,.62); color:#72777e; font-size:10px; }

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
        .home-page { padding:18px 16px; }
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


      /* HARMONY / RESPONSIVE WIDTH PASS */
      .dashboard-shell { grid-template-columns:240px minmax(0,1fr); }
      .dashboard-content { width:min(1180px,calc(100% - 48px)); padding:32px 0 64px; }
      .dashboard-top { padding-left:clamp(20px,3vw,40px); padding-right:clamp(20px,3vw,40px); }
      .page-title { margin-bottom:24px; }
      .page-title h1 { font-size:36px; }
      .dashboard-section, .form-card, .hours-card, .link-card { border-radius:16px; }
      .dashboard-section { padding:20px; }
      .form-card { gap:15px; padding:20px; }
      .overview-grid { gap:14px; margin-bottom:22px; }
      .metric-card { min-height:120px; padding:18px; }
      .appointment-list, .service-admin-list, .block-list { gap:9px; }
      .appointment-card { grid-template-columns:82px minmax(0,1fr) auto; gap:16px; padding:14px; }
      .appointment-time strong { font-size:18px; }
      .appointment-info strong { font-size:11px; }
      .two-column, .profile-settings-grid { gap:16px; }
      .service-admin, .block-row { padding:14px 15px; }
      .hours-row { grid-template-columns:155px minmax(0,1fr); gap:20px; padding:16px 18px; }
      .quick-actions { gap:9px; margin-top:18px; }

      .public-nav { width:min(1200px,calc(100% - 40px)); }
      .profile-hero { width:min(1200px,calc(100% - 40px)); min-height:600px; grid-template-columns:minmax(300px,.85fr) minmax(0,1.15fr); gap:clamp(40px,6vw,90px); padding:64px 0 72px; }
      .profile-image { min-height:390px; }
      .profile-content h1 { max-width:760px; }
      .public-section, .location-section, .contact-strip, .public-shell footer { width:min(1200px,calc(100% - 40px)); }
      .public-section { padding:58px 0 72px; }
      .section-heading { margin-bottom:22px; }
      .service-list { gap:14px; }
      .service-card { min-height:166px; padding:22px; gap:24px; }
      .contact-strip { margin-top:8px; padding:26px 28px; }
      .location-section { padding:68px 0 78px; }

      .booking-panel { width:min(720px,100%); }
      .booking-content { padding:26px !important; }
      .date-grid { gap:7px; margin:20px 0 21px; }
      .date-grid button { min-height:74px; }
      .slot-area { padding:17px; }
      .slot-grid { gap:8px; margin-top:11px; }
      .slot-grid button { min-height:44px; }

      @media (min-width: 1400px) {
        .dashboard-content { width:min(1240px,calc(100% - 72px)); }
        .public-nav, .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width:min(1280px,calc(100% - 72px)); }
      }

      @media (max-width: 900px) {
        .dashboard-shell { grid-template-columns:1fr; }
        .sidebar { position:fixed; inset:0 auto 0 0; width:min(270px,84vw); }
        .profile-hero { grid-template-columns:1fr; min-height:auto; gap:28px; padding:52px 0 58px; text-align:center; }
        .profile-content { margin:0 auto; }
        .profile-facts { justify-content:center; }
        .profile-image { min-height:300px; }
      }

      @media (max-width: 1100px) {
        .dashboard-content { width:min(1100px,calc(100% - 36px)); }
        .dashboard-shell { grid-template-columns:224px minmax(0,1fr); }
        .profile-hero { gap:44px; }
      }

      @media (max-width: 640px) {
        .dashboard-shell { grid-template-columns:1fr; }
        .dashboard-content { width:calc(100% - 24px); padding:24px 0 44px; }
        .dashboard-top { padding:9px 12px; }
        .page-title { margin-bottom:18px; }
        .page-title h1 { font-size:31px; }
        .dashboard-section, .form-card { padding:16px; }
        .overview-grid { gap:9px; margin-bottom:18px; }
        .metric-card { min-height:104px; padding:15px; }
        .appointment-card { grid-template-columns:64px minmax(0,1fr) auto; gap:10px; padding:12px; }
        .hours-row { grid-template-columns:1fr; gap:10px; padding:14px 15px; }
        .public-nav, .profile-hero, .public-section, .location-section, .contact-strip, .public-shell footer { width:calc(100% - 24px); }
        .profile-hero { min-height:auto; gap:26px; padding:42px 0 48px; }
        .profile-image { min-height:240px; }
        .public-section { padding:44px 0 54px; }
        .section-heading { margin-bottom:16px; }
        .service-list { gap:10px; }
        .service-card { min-height:145px; padding:17px; gap:16px; }
        .contact-strip { padding:20px; }
        .location-section { padding:48px 0 58px; }
        .booking-content { padding:18px !important; }
      }

      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
      }
      /* FINAL SCALE / DENSITY PASS */
      .dashboard-shell { grid-template-columns: 250px minmax(0,1fr); }
      .sidebar { padding: 18px 14px; }
      .sidebar-top { padding: 0 7px 11px; }
      .side-profile { gap: 11px; padding: 12px 10px; margin-bottom: 9px; }
      .side-profile strong { max-width: 170px; font-size: 13px; }
      .side-profile span { max-width: 170px; font-size: 10px; }
      .sidebar nav { gap: 1px; }
      .sidebar nav a { gap: 11px; padding: 11px 11px; border-radius: 10px; font-size: 13px; }
      .sidebar nav a.active::before { left: -14px; height: 22px; }
      .logout { gap: 11px; padding: 11px; font-size: 13px; }

      .dashboard-top { min-height: 68px; gap: 12px; padding: 10px clamp(18px,2.5vw,32px); }
      .top-kicker { font-size: 10px; }
      .dashboard-top strong { font-size: 14px; }
      .public-link { gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 11px; }

      .dashboard-content { width: min(1180px, calc(100% - 48px)); padding: 34px 0 60px; }
      .page-title { gap: 24px; margin-bottom: 24px; }
      .page-title h1 { font-size: 40px; }
      .page-title p { font-size: 13px; }
      .dashboard-section, .form-card, .hours-card, .link-card { border-radius: 16px; }
      .dashboard-section { padding: 21px; }
      .form-card { gap: 14px; padding: 21px; }
      .form-card h2, .section-heading h2 { font-size: 18px; }
      .section-heading { margin-bottom: 16px; }

      .metric-card { min-height: 122px; padding: 18px; }
      .metric-card strong { font-size: 28px; }
      .metric-card span { font-size: 11px; }
      .appointment-card { gap: 13px; padding: 15px; }
      .appointment-card strong { font-size: 14px; }
      .appointment-card span { font-size: 11px; }

      /* Keep the sidebar visually compact while making its controls larger. */
      .sidebar > * { flex-shrink: 0; }
      .sidebar nav a svg, .logout svg { width: 18px; height: 18px; }

      @media (max-width: 1100px) {
        .dashboard-shell { grid-template-columns: 228px minmax(0,1fr); }
        .dashboard-content { width: min(1040px, calc(100% - 36px)); }
        .sidebar nav a { font-size: 12px; }
      }

      @media (max-width: 640px) {
        .dashboard-content { width: calc(100% - 24px); padding: 24px 0 44px; }
        .page-title h1 { font-size: 34px; }
        .page-title p { font-size: 12px; }
        .dashboard-section, .form-card { padding: 18px; }
        .dashboard-top strong { font-size: 13px; }
      }

      /* THEME TOKENS */
      :root {
        --app-bg: #f5f5f4;
        --app-surface: #ffffff;
        --app-surface-soft: #f7f7f6;
        --app-text: #111214;
        --app-text-2: #4e535a;
        --app-muted: #777c83;
        --app-line: rgba(17,18,20,.085);
        --app-line-strong: rgba(17,18,20,.14);
        --app-shadow: 0 18px 50px rgba(17,18,20,.085);
      }

      html[data-theme='dark'] {
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

      html[data-theme='dark'] body { background:var(--app-bg); color:var(--app-text); }
      html[data-theme='dark'] .brand-mark { background:#f4f5f6; color:#111214; box-shadow:0 8px 20px rgba(0,0,0,.28); }
      html[data-theme='dark'] .brand-dot { color:#686e76; }
      html[data-theme='dark'] .eyebrow,
      html[data-theme='dark'] .muted,
      html[data-theme='dark'] .page-title p,
      html[data-theme='dark'] .auth-lead,
      html[data-theme='dark'] .profile-description,
      html[data-theme='dark'] .contact-strip p,
      html[data-theme='dark'] .location-section p,
      html[data-theme='dark'] .appointment-time span,
      html[data-theme='dark'] .appointment-info span,
      html[data-theme='dark'] .metric-card > span,
      html[data-theme='dark'] .metric-card p,
      html[data-theme='dark'] .closed,
      html[data-theme='dark'] .text-link { color:var(--app-muted); }

      html[data-theme='dark'] .button-primary,
      html[data-theme='dark'] .button-dark { color:#111214; background:#f4f5f6; box-shadow:0 10px 24px rgba(0,0,0,.3); }
      html[data-theme='dark'] .button-soft { color:#f0f2f4; background:#202328; border-color:var(--app-line-strong); box-shadow:none; }
      html[data-theme='dark'] .button-ghost { color:#b3b8be; }
      html[data-theme='dark'] .button-danger { color:#ffb1b1; background:#321d1f; border-color:rgba(255,120,120,.16); }
      html[data-theme='dark'] .icon-button { color:#e8eaec; background:#1c1f22; border-color:var(--app-line); }
      html[data-theme='dark'] .icon-button:hover { background:#25282c; }

      html[data-theme='dark'] .field > span,
      html[data-theme='dark'] .media-field > span { color:#c9cdd1; }
      html[data-theme='dark'] .field input,
      html[data-theme='dark'] .field textarea,
      html[data-theme='dark'] .time-inputs input,
      html[data-theme='dark'] .hours-row input[type='time'] {
        background:#1b1e21 !important;
        color:#f4f5f6 !important;
        border-color:var(--app-line-strong) !important;
        box-shadow:none !important;
      }
      html[data-theme='dark'] .field input::placeholder,
      html[data-theme='dark'] .field textarea::placeholder { color:#747b83; }
      html[data-theme='dark'] .field input:focus,
      html[data-theme='dark'] .field textarea:focus { border-color:rgba(255,255,255,.34) !important; box-shadow:0 0 0 3px rgba(255,255,255,.06) !important; }
      html[data-theme='dark'] .form-error { color:#ffb2b2; background:#321d1f; border-color:rgba(255,120,120,.15); }
      html[data-theme='dark'] .saved { color:#a7e1bb; background:#182a20; border-color:rgba(120,220,155,.14); }

      html[data-theme='dark'] .center-page { background:radial-gradient(circle at 50% 15%,#25282c,transparent 36%),#111315; }
      html[data-theme='dark'] .panel,
      html[data-theme='dark'] .auth-card,
      html[data-theme='dark'] .dashboard-section,
      html[data-theme='dark'] .form-card,
      html[data-theme='dark'] .hours-card,
      html[data-theme='dark'] .link-card { background:rgba(25,27,30,.94); border-color:var(--app-line); box-shadow:var(--app-shadow); }
      html[data-theme='dark'] .panel.centered p { color:var(--app-muted); }

      html[data-theme='dark'] .home-page { background:radial-gradient(circle at 82% 20%,#25282c,transparent 24%),linear-gradient(135deg,#111315 0%,#151719 58%,#202328 100%); }
      html[data-theme='dark'] .home-page::before,
      html[data-theme='dark'] .auth-aside::after,
      html[data-theme='dark'] .public-shell::before { border-color:rgba(255,255,255,.07); }
      html[data-theme='dark'] .home-copy p,
      html[data-theme='dark'] .auth-aside p { color:#a8adb3; }
      html[data-theme='dark'] .home-note { color:#a4aab0; background:rgba(255,255,255,.04); border-color:var(--app-line); }

      html[data-theme='dark'] .auth-page { background:#111315; }
      html[data-theme='dark'] .auth-aside { background:radial-gradient(circle at 72% 30%,#24272b,transparent 25%),linear-gradient(145deg,#151719,#202328); border-color:var(--app-line); }
      html[data-theme='dark'] .auth-card { background:#191b1e; }
      html[data-theme='dark'] .switch-auth { color:#9299a1; }
      html[data-theme='dark'] .switch-auth button { color:#f4f5f6; }

      html[data-theme='dark'] .public-shell { background:radial-gradient(circle at 78% 8%,color-mix(in srgb,var(--profile-primary,#fff) 8%,#191b1e),transparent 26%),#151719; }
      html[data-theme='dark'] .public-nav { background:rgba(25,27,30,.88); border-color:var(--app-line); }
      html[data-theme='dark'] .public-links a { color:#a8adb3; }
      html[data-theme='dark'] .public-links a:hover { color:#fff; background:rgba(255,255,255,.06); }
      html[data-theme='dark'] .profile-image::before { background:linear-gradient(145deg,#202328,#151719); border-color:var(--app-line); box-shadow:20px 25px 55px rgba(0,0,0,.3); }
      html[data-theme='dark'] .profile-image .avatar { border-color:#202328; }
      html[data-theme='dark'] .profile-specialty { color:#d5d8dc; }
      html[data-theme='dark'] .profile-facts span { background:rgba(255,255,255,.04); border-color:var(--app-line); color:#b6bbc1; }
      html[data-theme='dark'] .service-card { background:#191b1e; border-color:var(--app-line); box-shadow:0 7px 24px rgba(0,0,0,.2); }
      html[data-theme='dark'] .service-card:hover { border-color:var(--app-line-strong); box-shadow:0 16px 36px rgba(0,0,0,.28); }
      html[data-theme='dark'] .service-card p,
      html[data-theme='dark'] .service-duration { color:#9da3aa; }
      html[data-theme='dark'] .contact-strip { background:linear-gradient(135deg,#1d2023,#151719); border-color:var(--app-line); }
      html[data-theme='dark'] .public-shell footer { border-color:var(--app-line); color:#777e86; }

      html[data-theme='dark'] .booking-overlay { background:rgba(0,0,0,.56) !important; }
      html[data-theme='dark'] .booking-panel { background:rgba(25,27,30,.97) !important; border-color:rgba(255,255,255,.12) !important; box-shadow:0 28px 80px rgba(0,0,0,.48) !important; }
      html[data-theme='dark'] .booking-top { background:rgba(25,27,30,.92) !important; border-color:var(--app-line) !important; }
      html[data-theme='dark'] .booking-top > div:nth-child(2) small,
      html[data-theme='dark'] .selected-service span,
      html[data-theme='dark'] .booking-heading p,
      html[data-theme='dark'] .summary-mini p { color:#9299a1; }
      html[data-theme='dark'] .selected-service,
      html[data-theme='dark'] .summary-mini { background:linear-gradient(135deg,#202328,#191b1e); border-color:var(--app-line); box-shadow:none; }
      html[data-theme='dark'] .selected-service button,
      html[data-theme='dark'] .back-link { color:#b9bec4; }
      html[data-theme='dark'] .date-grid button,
      html[data-theme='dark'] .slot-grid button { background:#1b1e21; color:#c8cdd2; border-color:var(--app-line-strong); }
      html[data-theme='dark'] .date-grid button.selected,
      html[data-theme='dark'] .slot-grid button.selected { color:#111214; }
      html[data-theme='dark'] .slot-area { background:#17191c; border-color:var(--app-line); }
      html[data-theme='dark'] .booking-receipt { background:var(--app-line); border-color:var(--app-line); }
      html[data-theme='dark'] .booking-receipt > div { background:#1c1f22; }
      html[data-theme='dark'] .booking-receipt span { color:#858c94; }
      html[data-theme='dark'] .confirmation > p { color:#9da3aa; }

      html[data-theme='dark'] .dashboard-shell { background:#111315; }
      html[data-theme='dark'] .sidebar { background:rgba(25,27,30,.9); border-color:var(--app-line); }
      html[data-theme='dark'] .side-profile { background:rgba(255,255,255,.035); border-color:var(--app-line); }
      html[data-theme='dark'] .side-profile span { color:#8e959d; }
      html[data-theme='dark'] .sidebar nav a { color:#9da3aa; }
      html[data-theme='dark'] .sidebar nav a:hover { color:#f4f5f6; background:rgba(255,255,255,.05); }
      html[data-theme='dark'] .sidebar nav a.active { color:#fff; background:rgba(255,255,255,.08); }
      html[data-theme='dark'] .sidebar nav a.active::before { background:#f4f5f6; }
      html[data-theme='dark'] .logout { color:#9299a1; }
      html[data-theme='dark'] .logout:hover { color:#ffb1b1; background:#321d1f; }
      html[data-theme='dark'] .dashboard-top { background:rgba(17,19,21,.86); border-color:var(--app-line); }
      html[data-theme='dark'] .top-kicker { color:#858c94; }
      html[data-theme='dark'] .public-link { background:#1c1f22; color:#c4c9ce; border-color:var(--app-line); }
      html[data-theme='dark'] .metric-card,
      html[data-theme='dark'] .appointment-card,
      html[data-theme='dark'] .service-admin,
      html[data-theme='dark'] .block-row,
      html[data-theme='dark'] .hour-row { background:#191b1e; border-color:var(--app-line); }
      html[data-theme='dark'] .metric-card::after { background:#25282c; }
      html[data-theme='dark'] .appointment-card:hover,
      html[data-theme='dark'] .service-admin:hover,
      html[data-theme='dark'] .block-row:hover,
      html[data-theme='dark'] .hour-row:hover { border-color:var(--app-line-strong); box-shadow:0 9px 22px rgba(0,0,0,.22); }
      html[data-theme='dark'] .tabs { background:#1b1e21; border-color:var(--app-line); }
      html[data-theme='dark'] .tabs button { color:#949ba3; }
      html[data-theme='dark'] .tabs button.active { color:#f4f5f6; background:#292c30; box-shadow:none; }
      html[data-theme='dark'] .small-action { background:#202328; color:#c0c5ca; border-color:var(--app-line); }
      html[data-theme='dark'] .small-action.danger { color:#ffadad; }
      html[data-theme='dark'] .copy-field { background:#1b1e21; border-color:var(--app-line-strong); }
      html[data-theme='dark'] .copy-field span { color:#a7adb4; }
      html[data-theme='dark'] .copy-field button { background:#292c30; color:#e7e9eb; }
      html[data-theme='dark'] .hours-row > div[style] > div { border-color:var(--app-line) !important; }
      html[data-theme='dark'] .empty { background:rgba(255,255,255,.025); border-color:rgba(255,255,255,.14); }
      html[data-theme='dark'] .empty-icon,
      html[data-theme='dark'] .link-card-icon { background:#25282c; }
      html[data-theme='dark'] .empty p { color:#858c94; }

      .theme-toggle { flex:0 0 auto; display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; padding:0; border:1px solid var(--ui-line); border-radius:10px; background:rgba(255,255,255,.7); color:var(--ui-ink); cursor:pointer; transition:transform .18s ease,background .18s ease,border-color .18s ease; }
      .theme-toggle:hover { transform:translateY(-1px); background:var(--app-surface); border-color:var(--ui-line-strong); }
      .theme-toggle:active { transform:scale(.96); }
      html[data-theme='dark'] .theme-toggle { background:#1c1f22; color:#f4f5f6; }
      .theme-toggle-label { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

      @media (max-width: 900px) {
        html[data-theme='dark'] .public-links { background:rgba(25,27,30,.98); border-color:var(--app-line); }
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('agenda-theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('agenda-theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  }

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
      <Dashboard userId={session.user.id} onToggleTheme={toggleTheme} theme={theme} />
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