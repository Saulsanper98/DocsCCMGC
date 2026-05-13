import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { CcmgcBrandLogo } from '@/shared/components/CcmgcBrandLogo';
import { useAuth } from './useAuth';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Checkbox } from '@/shared/components/ui/Checkbox';

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
    <div className="login-hero relative min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        {/* Marca CCMGC + producto */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-full rounded-2xl bg-[#0c1222] p-6 sm:p-8 mb-5 shadow-xl ring-1 ring-white/10">
            <CcmgcBrandLogo variant="login" />
          </div>
          <p className="text-lg font-semibold text-[var(--foreground)]">DocBrain</p>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 text-center">
            Plataforma de documentación · CCMGC
          </p>
        </div>

        {/* Card */}
        <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-6">Acceder al sistema</h2>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[var(--destructive)] dark:border-red-800/80 dark:bg-red-950/30"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              floatingLabel
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Contraseña"
              floatingLabel
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              leftIcon={<Lock className="w-4 h-4" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer hover:text-[var(--foreground)] transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              label="Recordar sesión"
            />

            <Button type="submit" className="w-full" loading={submitting}>
              Iniciar sesión
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--card)] px-2 text-[var(--muted-foreground)]">o continúa con</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={signInWithMicrosoft}
            type="button"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M11.4 24H0V12.6h11.4V24z" fill="#F1511B" />
              <path d="M24 24H12.6V12.6H24V24z" fill="#80CC28" />
              <path d="M11.4 11.4H0V0h11.4v11.4z" fill="#00ADEF" />
              <path d="M24 11.4H12.6V0H24v11.4z" fill="#FBBC09" />
            </svg>
            Iniciar sesión con Microsoft
          </Button>
        </div>

        <p className="text-center text-xs text-[var(--muted-foreground)] mt-6">
          Acceso restringido al personal del CCMGC
        </p>
      </div>
    </div>
  );
}
