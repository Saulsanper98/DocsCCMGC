import { cn } from '@/shared/utils/cn';

/** Logo oficial CCMGC (paleta amarillo sobre negro) — servido desde `/public`. */
export const CC_MGC_LOGO_SRC = '/ccmgc-logo.png';

type Variant = 'login' | 'sidebar-expanded' | 'sidebar-collapsed' | 'header';

const variantClass: Record<Variant, string> = {
  login: 'w-full max-w-md h-auto max-h-[220px] object-contain',
  /** Cabecera lateral: que quepa en h-14 junto al texto sin desalinear la barra. */
  'sidebar-expanded': 'h-8 w-auto max-w-[min(200px,100%)] object-left object-contain sm:h-9',
  'sidebar-collapsed': 'h-7 w-7 sm:h-8 sm:w-8 object-contain',
  header: 'h-6 w-auto max-h-7 sm:h-7 sm:max-h-8 object-contain',
};

/** En UI oscura, el PNG con fondo negro se integra: `lighten` hace que el negro adopte el tono del sidebar. */
const blendClass = 'mix-blend-lighten';

export function CcmgcBrandLogo({
  variant,
  className,
  /** Mezclar fondo negro del PNG con el fondo del contenedor (sidebar, header). No usar en login sobre bloque negro explícito. */
  blendWithBackground,
}: {
  variant: Variant;
  className?: string;
  blendWithBackground?: boolean;
}) {
  return (
    <img
      src={CC_MGC_LOGO_SRC}
      alt="Centro de Control de la Movilidad de Gran Canaria (CCMGC)"
      className={cn(variantClass[variant], blendWithBackground && blendClass, className)}
      decoding="async"
      fetchPriority={variant === 'login' ? 'high' : 'auto'}
    />
  );
}
