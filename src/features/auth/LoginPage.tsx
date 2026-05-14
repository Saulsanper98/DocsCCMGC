import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './useAuth';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Checkbox } from '@/shared/components/ui/Checkbox';
import { cn } from '@/shared/utils/cn';

/** Logo horizontal oficial (fondo negro) — `public/ccmgc-brand-login.png`. */
const CC_MGC_BRAND_LOGIN_SRC = '/ccmgc-brand-login.png';

const loginInputWrap =
  'rounded-none bg-transparent shadow-none transition-none focus-within:shadow-none focus-within:ring-0';

const loginInputClass =
  'min-h-[3.5rem] h-auto pt-8 pb-3.5 rounded-none border-0 border-b border-white/20 bg-transparent text-slate-100 caret-[var(--accent)] shadow-none ring-0 transition-colors placeholder:text-transparent focus:border-[var(--accent)] focus:ring-0 focus-visible:border-[var(--accent)] focus-visible:ring-0 dark:border-white/20';

/** Más aire entre etiqueta flotante y el valor (login estilo subrayado). */
const loginFloatingLabelClass =
  'peer-focus:top-1 peer-[:not(:placeholder-shown)]:top-1';

const iconAccent = 'text-[color-mix(in_srgb,var(--accent)_78%,transparent)]';

export function LoginPage() {
  const { user, loading, error, signIn, signInWithMicrosoft } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await signIn(email, password);
    setSubmitting(false);
  }

  return (
    <div className="login-hero relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
      <div
        className="pointer-events-none absolute -left-32 top-1/4 h-[min(480px,50vh)] w-[min(480px,88vw)] rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-28 bottom-[14%] h-[min(400px,42vh)] w-[min(400px,78vw)] rounded-full bg-[color-mix(in_srgb,var(--brand-500)_14%,transparent)] blur-[96px]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[min(420px,calc(100vw-2rem))]">
        <div
          className={cn(
            'login-brand-fields overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(12,12,12,0.55)] px-6 pb-8 pt-9 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:px-9 sm:pb-9 sm:pt-10',
          )}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--accent)_45%,transparent)] to-transparent"
            aria-hidden
          />

          <div
            role="img"
            aria-label="Centro de Control de la Movilidad de Gran Canaria (CCMGC)"
            className="login-brand-logo-wrap relative mx-auto w-full max-w-[min(100%,300px)] sm:max-w-[320px]"
          >
            <img
              src={CC_MGC_BRAND_LOGIN_SRC}
              alt=""
              decoding="async"
              fetchPriority="high"
              aria-hidden
              className="login-brand-logo-measure pointer-events-none h-auto w-full max-h-[min(132px,28vw)] object-contain sm:max-h-[min(140px,24vw)]"
            />
            <div className="login-brand-logo-accent pointer-events-none absolute inset-0" aria-hidden />
          </div>

          <div className="mt-8 text-center">
            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[1.65rem]">DocBrain</h1>
            <p className="mt-1.5 text-[13px] font-medium tracking-wide text-slate-400">
              Plataforma de documentación <span className="text-slate-600">·</span> CCMGC
            </p>
          </div>

          <div className="mt-10 border-t border-white/[0.06] pt-9">
            <h2 className="mb-6 text-[15px] font-semibold tracking-tight text-slate-100">Acceder al sistema</h2>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-5 rounded-xl border border-red-500/30 bg-red-950/50 p-3.5 text-sm text-red-200"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Input
                label="Correo electrónico"
                floatingLabel
                floatingLabelClassName={loginFloatingLabelClass}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                wrapperClassName={loginInputWrap}
                leftIcon={<Mail className={cn('h-4 w-4', iconAccent)} />}
                className={loginInputClass}
              />

              <Input
                label="Contraseña"
                floatingLabel
                floatingLabelClassName={loginFloatingLabelClass}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                wrapperClassName={loginInputWrap}
                leftIcon={<Lock className={cn('h-4 w-4', iconAccent)} />}
                className={loginInputClass}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="cursor-pointer rounded-md text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-[var(--accent)]"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <div className="[&_label]:text-slate-400">
                <Checkbox
                  id="remember"
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  label="Recordar sesión"
                  className="border-white/20 bg-transparent data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:text-[var(--primary-foreground)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 focus-visible:ring-offset-transparent"
                />
              </div>

              <Button
                type="submit"
                size="lg"
                variant="default"
                className="w-full shadow-[0_0_32px_-8px_color-mix(in_srgb,var(--accent)_42%,transparent)] focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                loading={submitting}
              >
                Iniciar sesión
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                <span className="bg-[#0c0c0c]/90 px-3 backdrop-blur-sm">o continúa con</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              className="w-full border-white/15 bg-transparent text-slate-200 shadow-none hover:bg-white/[0.06] hover:text-white"
              onClick={signInWithMicrosoft}
              type="button"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M11.4 24H0V12.6h11.4V24z" fill="#F1511B" />
                <path d="M24 24H12.6V12.6H24V24z" fill="#80CC28" />
                <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#00ADEF" />
                <path d="M24 11.4H12.6V0H24v11.4z" fill="#FBBC09" />
              </svg>
              Iniciar sesión con Microsoft
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-slate-500">
          Acceso restringido al personal del CCMGC
        </p>
      </div>
    </div>
  );
}
