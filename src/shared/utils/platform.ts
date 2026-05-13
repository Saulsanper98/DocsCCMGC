/** Entorno del navegador para etiquetas de atajos (Mac vs Windows/Linux). */

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const p = navigator.platform ?? '';
  const ua = navigator.userAgent ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(p) || /Mac OS/.test(ua);
}

/** Texto para “modificador + K” en la UI (búsqueda global). */
export function formatSearchShortcut(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl+K';
}

/** Etiqueta del modificador principal en atajos. */
export function formatModLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl';
}
