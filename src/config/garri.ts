/**
 * Official GARRI ecosystem configuration.
 *
 * Token values are read from build-time env vars and are intentionally EMPTY by default.
 * Never hard-code a contract/mint address or purchase URL here — the GARRI team must
 * confirm them, then set VITE_GARRI_MINT_ADDRESS / VITE_GARRI_PUMPFUN_URL in Netlify.
 */
const env = import.meta.env

export const GARRI_TOKEN = {
  symbol: '$GARRI',
  network: (env.VITE_GARRI_NETWORK as string | undefined) || 'Solana',
  mintAddress: ((env.VITE_GARRI_MINT_ADDRESS as string | undefined) || '').trim(),
  pumpFunUrl: ((env.VITE_GARRI_PUMPFUN_URL as string | undefined) || '').trim(),
}

export const GARRI_SOCIAL = {
  x: { handle: '@Garrionchain', url: 'https://x.com/Garrionchain' },
  telegram: { handle: '@GARRIONCHAIN', url: 'https://t.me/GARRIONCHAIN' },
  website: ((env.VITE_GARRI_WEBSITE_URL as string | undefined) || '').trim(),
}

export const isTokenConfigured = () => GARRI_TOKEN.mintAddress.length > 0
export const isBuyLinkConfigured = () => /^https:\/\/(www\.)?pump\.fun\//.test(GARRI_TOKEN.pumpFunUrl)
