/** Runtime health endpoint: reports configuration presence, not DB reachability. */
export default async (_request: Request) => {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
  return Response.json({
    service: 'garriverse-api',
    status: 'ok',
    version: '0.2.0',
    capabilities: {
      supabaseCredentials: configured ? 'configured_not_connection_tested' : 'not_configured',
      authentication: configured ? 'endpoints_available' : 'not_configured',
      playerStateRead: configured ? 'endpoint_available' : 'not_configured',
      playerStateWrite: 'disabled_until_server_authoritative_actions',
      realTokenRewards: 'disabled',
    },
    timestamp: new Date().toISOString(),
  }, { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}