/**
 * Host bridge for embedding the game (Asta DAO app, Capacitor shell, iframes).
 *
 * Outgoing events are sent with window.parent.postMessage when the game runs inside a
 * frame, and through a Capacitor/ReactNative-style `window.GarriHost.onEvent` hook if the
 * host injects one. No private host APIs are assumed. See README "Embedding" for the contract.
 */
export type GarriEvent = { type: 'garri:ready'; version: 1 } | { type: 'garri:level'; level: number }

declare global {
  interface Window {
    GarriHost?: { onEvent?: (e: GarriEvent) => void }
  }
}

export function postToHost(event: GarriEvent) {
  try {
    window.GarriHost?.onEvent?.(event)
    if (window.parent && window.parent !== window) window.parent.postMessage(event, '*')
  } catch {
    // host bridge is optional — never break the game because of it
  }
}
