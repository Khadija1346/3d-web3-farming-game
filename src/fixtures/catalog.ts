/**
 * Game design catalog for the preview build.
 *
 * Everything here is static game design data (crop rules, factory stages, quest templates,
 * integration status). It contains NO player data, balances, users or leaderboard entries.
 * A later milestone moves the authoritative copy of these rules to the server.
 */

export const CROP = {
  name: 'Cassava (TME 419)',
  growSeconds: 90, // compressed: one in-game season ≈ 90 real seconds
  waterDrainSeconds: 55,
  weedGrowSeconds: 110,
  rootsMin: 6,
  rootsMax: 9,
}

export const ECONOMY = {
  startingStems: 12,
  startingNaira: 500,
  stemBundlePrice: 150,
  garriBagPrice: 1200,
  rootsPerBatch: 5,
  bagsPerBatch: 2,
  wateringCanUses: 5,
  tankerCapacity: 100,
}

export const XP_REWARDS = {
  till: 4,
  plant: 6,
  water: 3,
  weed: 4,
  harvest: 20,
  processStage: 6,
  package: 25,
  sell: 10,
}

export interface FactoryStage {
  id: string
  label: string
  verb: string
  seconds: number
  detail: string
}

export const FACTORY_STAGES: FactoryStage[] = [
  { id: 'peel', label: 'Peeling', verb: 'Peel roots', seconds: 3, detail: 'Strip the brown skin and woody ends from fresh cassava.' },
  { id: 'wash', label: 'Washing', verb: 'Wash', seconds: 2.5, detail: 'Rinse peeled roots in clean borehole water.' },
  { id: 'grate', label: 'Grating', verb: 'Grate', seconds: 3, detail: 'Feed roots through the diesel grater into a wet mash.' },
  { id: 'ferment', label: 'Fermentation', verb: 'Bag & ferment', seconds: 8, detail: 'Pack mash in sacks and leave to sour — this gives garri its tang.' },
  { id: 'dewater', label: 'Dewatering', verb: 'Press', seconds: 4, detail: 'Screw-press the sacks to squeeze out the starchy water.' },
  { id: 'sieve', label: 'Sieving', verb: 'Sieve', seconds: 3, detail: 'Break up the cake and sieve out fibre for a fine grain.' },
  { id: 'fry', label: 'Frying', verb: 'Fry', seconds: 5, detail: 'Toast in wide pans over firewood, stirring until crisp and dry.' },
  { id: 'pack', label: 'Packaging', verb: 'Bag garri', seconds: 2.5, detail: 'Cool, weigh and stitch into branded GARRI bags.' },
]

export interface QuestTemplate {
  id: string
  title: string
  cadence: 'daily' | 'weekly' | 'special'
  goal: string
  reward: string
}

/** Quest templates — shown as "coming with accounts"; no progress is faked. */
export const QUEST_TEMPLATES: QuestTemplate[] = [
  { id: 'd-plant', title: 'Morning Rows', cadence: 'daily', goal: 'Plant 4 plots of cassava', reward: '60 XP · 2 stem bundles' },
  { id: 'd-water', title: 'Borehole Run', cadence: 'daily', goal: 'Water 6 growing plots', reward: '40 XP' },
  { id: 'w-garri', title: 'Market Day', cadence: 'weekly', goal: 'Package 10 bags of garri', reward: '400 XP · Market badge' },
  { id: 's-tractor', title: 'Mechanised Farmer', cadence: 'special', goal: 'Till 20 plots with the tractor', reward: 'Achievement' },
]

export type IntegrationState = 'live' | 'preview' | 'pending'

export interface Integration {
  name: string
  state: IntegrationState
  note: string
}

export const INTEGRATIONS: Integration[] = [
  { name: '3D village & farming loop', state: 'preview', note: 'Playable now. Progress lives in this browser tab until accounts launch.' },
  { name: 'Garri processing factory', state: 'preview', note: 'All 8 stages playable in the preview session.' },
  { name: 'Accounts (Google, X, email)', state: 'pending', note: 'Needs OAuth client credentials from the GARRI team.' },
  { name: 'Server-saved progress & leaderboard', state: 'pending', note: 'Scheduled in the roadmap — no placeholder rankings are shown.' },
  { name: 'Wallet sign-in (Solana)', state: 'pending', note: 'Signed-message login — a typed address will never count.' },
  { name: 'NFT gallery', state: 'pending', note: 'Requires official collection addresses. No sample NFTs are displayed.' },
  { name: '$GARRI contract & buy link', state: 'pending', note: 'Shown once the official mint address is configured.' },
  { name: 'Real $GARRI rewards & withdrawals', state: 'pending', note: 'Disabled until contracts, tokenomics and eligibility are approved.' },
]
