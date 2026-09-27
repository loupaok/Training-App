const DISCORD_API = 'https://discord.com/api/v10';

function guildId() {
  return process.env.DISCORD_GUILD_ID;
}

function botHeaders() {
  return {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export async function botRequest(method, endpoint, data) {
  const response = await fetch(`${DISCORD_API}${endpoint}`, {
    method,
    headers: botHeaders(),
    body: data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.message || `Discord bot request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export async function getGuildRoles() {
  return botRequest('GET', `/guilds/${guildId()}/roles`);
}

export async function addMemberToGuild(discordId, accessToken) {
  return botRequest('PUT', `/guilds/${guildId()}/members/${discordId}`, { access_token: accessToken });
}

export async function addRole(discordId, roleId) {
  return botRequest('PUT', `/guilds/${guildId()}/members/${discordId}/roles/${roleId}`);
}

export async function removeRole(discordId, roleId) {
  return botRequest('DELETE', `/guilds/${guildId()}/members/${discordId}/roles/${roleId}`);
}

export async function kickMember(discordId) {
  return botRequest('DELETE', `/guilds/${guildId()}/members/${discordId}`);
}

export async function getGuildMember(discordId) {
  try {
    return await botRequest('GET', `/guilds/${guildId()}/members/${discordId}`);
  } catch (error) {
    if (error.message?.includes('Unknown Member')) return null;
    throw error;
  }
}

const ACTIVE_ROLE_NAME = 'Ενεργό Μέλος';
let cachedActiveRoleId = null;

// Best-effort, cached lookup — never throws. A missing/renamed role or an
// unreachable Discord API should degrade the integration, not crash callers.
export async function getActiveRoleId({ forceRefresh = false } = {}) {
  if (cachedActiveRoleId && !forceRefresh) return cachedActiveRoleId;
  try {
    const roles = await getGuildRoles();
    const role = roles?.find((r) => r.name === ACTIVE_ROLE_NAME);
    cachedActiveRoleId = role?.id || null;
    if (!cachedActiveRoleId) {
      console.error(`Discord role "${ACTIVE_ROLE_NAME}" not found on the configured server.`);
    }
    return cachedActiveRoleId;
  } catch (error) {
    console.error('Discord getActiveRoleId failed:', error.message);
    return null;
  }
}

// OAuth2 — exchanges the authorization code Discord redirected back with for
// a user access token. Form-encoded per Discord's token endpoint requirements.
export async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error_description || body?.error || `Discord token exchange failed (${response.status})`);
  }
  return body;
}

export async function getDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.message || `Discord user lookup failed (${response.status})`);
  }
  return body;
}

export function buildAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.join',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
