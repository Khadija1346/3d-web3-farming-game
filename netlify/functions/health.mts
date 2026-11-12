/**
 * Runtime health endpoint.
 * Reports configuration only; it does not claim that a database is reachable.
 */
export default async (_request: Request) => {
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

  return Response.json(
    {
      service: 'garriverse-api',
      status: 'ok',
      version: '0.1.0',
      capabilities: {
        database: supabaseConfigured ? 'credentials_configured_not_connection_tested' : 'not_configured',
        playerPersistence: 'disabled',
        realTokenRewards: 'disabled',
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    },
  )
}
