/** Muestra un correo de forma más discreta en listas (capturas / vistas de equipo). */
export function formatPrivacyEmail(email: string | undefined | null, maxLocal = 12): string {
  if (!email || !email.includes('@')) return email ?? '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= maxLocal) return `${local}@${domain}`;
  return `${local.slice(0, 3)}…${local.slice(-2)}@${domain}`;
}
