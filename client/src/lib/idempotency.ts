/**
 * Create the key used to safely retry an order submission.
 * randomUUID is not exposed on non-secure LAN origins in some browsers, so
 * use getRandomValues there (which is available in insecure contexts).
 */
export function createIdempotencyKey(): string {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  if (typeof webCrypto?.getRandomValues === 'function') {
    const bytes = webCrypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // This value only deduplicates a request; it is not an authentication secret.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
