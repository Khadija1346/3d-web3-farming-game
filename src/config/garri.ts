/**
 * Canonical GARRI token and Robinhood Chain configuration.
 * The token contract is independently visible on Robinhood Chain Blockscout.
 */
const env = import.meta.env

export const GARRI_TOKEN = {
  symbol: '$GARRI',
  network: 'Robinhood Chain',
  chainId: 4663,
  rpcUrl: 'https://rpc.mainnet.chain.robinhood.com',
  explorerUrl: 'https://robinhoodchain.blockscout.com/token/0xdddf7ab756c35b4d0537825497e6932780710241',
  contractAddress: '0xdDDF7AB756C35b4d0537825497e6932780710241',
  // Compatibility alias for older UI components; this is an EVM ERC-20 address, not a Solana mint.
  mintAddress: '0xdDDF7AB756C35b4d0537825497e6932780710241',
}

export const GARRI_SOCIAL = {
  x: { handle: '@Garrionchain', url: 'https://x.com/Garrionchain' },
  telegram: { handle: '@GARRIONCHAIN', url: 'https://t.me/GARRIONCHAIN' },
  website: ((env.VITE_GARRI_WEBSITE_URL as string | undefined) || '').trim(),
}

export const isTokenConfigured = () => /^0x[a-fA-F0-9]{40}$/.test(GARRI_TOKEN.contractAddress)
