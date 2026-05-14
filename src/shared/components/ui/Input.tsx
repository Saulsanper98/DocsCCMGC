import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Etiqueta flotante (Material-style); requiere `label`. Usa `placeholder=" "` si no quieres placeholder visible. */
  floatingLabel?: boolean;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Contenedor relativo (iconos, sombra del campo). */
  wrapperClassName?: string;
  /** Solo con `floatingLabel`: clases extra para la etiqueta flotante (p. ej. posición `top-*`). */
  floatingLabelClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      floatingLabel,
      error,
      leftIcon,
      rightIcon,
      wrapperClassName,
      floatingLabelClassName,
      id,
      placeholder,
      ...props
    },
    ref,
  ) => {
    const genId = useId();
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const errorId = error ? `${genId}-error` : undefined;

    if (label && floatingLabel) {
      return (
        <div className="flex flex-col gap-1.5">
          <div
            className={cn(
              'relative rounded-lg shadow-sm transition-shadow focus-within:shadow-md',
              wrapperClassName,
            )}
          >
            {leftIcon && (
              <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--muted-foreground)]">
                {leftIcon}
              </span>
            )}
            <input
              ref={ref}
              id={inputId}
              placeholder={placeholder ?? ' '}
              aria-label={label}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
              className={cn(
                'peer h-11 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 pb-2 pt-4 text-sm text-[var(--foreground)] transition-[color,box-shadow,border-color] placeholder:text-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
                leftIcon && 'pl-9',
                rightIcon && 'pr-9',
                error && 'border-[var(--destructive)] focus:ring-[var(--destructive)]',
                className,
              )}
              {...props}
            />
            <label
              htmlFor={inputId}
              className={cn(
                'pointer-events-none absolute top-1/2 z-[1] origin-left -translate-y-1/2 text-sm text-[var(--muted-foreground)] transition-all duration-200',
                leftIcon ? 'left-10' : 'left-3',
                'peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-[var(--accent)]',
                'peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs',
                floatingLabelClassName,
              )}
            >
              {label}
            </label>
            {rightIcon && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{rightIcon}</span>
            )}
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-xs text-[var(--destructive)]">
              {error}
            </p>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--foreground)]">
            {label}
          </label>
        )}
        <div
          className={cn(
            'relative rounded-lg shadow-sm transition-shadow focus-within:shadow-md',
            wrapperClassName,
          )}
        >
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[var(--muted-foreground)]">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            className={cn(
              'h-9 w-full rounded-lg border border-[var(--input)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] transition-[color,box-shadow,border-color] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-[var(--destructive)] focus:ring-[var(--destructive)]',
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]">{rightIcon}</span>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-[var(--destructive)]">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
