/** Etiqueta corta de entorno: `import.meta.env.VITE_APP_ENV` o `import.meta.env.MODE`. */
export function buildEnvSuffix(): string | null {
  const custom = import.meta.env.VITE_APP_ENV?.trim();
  if (custom) return custom;
  const m = import.meta.env.MODE;
  if (m === 'production') return null;
  if (m === 'development') return 'dev';
  return m;
}
