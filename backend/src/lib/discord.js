import { getDiscordConfig } from './discord-settings.js';

const DISCORD_API = 'https://discord.com/api/v10';
let cachedActiveRoleId = null;
let cachedRoleConfigKey = null;

export function clearDiscordRoleCache() {
  cachedActiveRoleId = null;
  cachedRoleConfigKey = null;
}

async function getConfiguredGuildId() {
  const config = await getDiscordConfig();
  if (!config.enabled || !config.guildId) throw new Error('Discord integration is not configured.');
  return config.guildId;
}

export async function botRequest(method, endpoint, data) {
  const config = await getDiscordConfig();
  if (!config.enabled || !config.botToken || !config.guildId) throw new Error('Discord integration is not configured.');
  const response = await fetch(`${DISCORD_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bot ${config.botToken}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Discord bot request failed (${response.status})`);
  return body;
}

export async function getGuildRoles() {
  return botRequest('GET', `/guilds/${await getConfiguredGuildId()}/roles`);
}

export async function addMemberToGuild(discordId, accessToken) {
  return botRequest('PUT', `/guilds/${await getConfiguredGuildId()}/members/${discordId}`, { access_token: accessToken });
}

export async function addRole(discordId, roleId) {
  return botRequest('PUT', `/guilds/${await getConfiguredGuildId()}/members/${discordId}/roles/${roleId}`);
}

export async function removeRole(discordId, roleId) {
  return botRequest('DELETE', `/guilds/${await getConfiguredGuildId()}/members/${discordId}/roles/${roleId}`);
}

export async function kickMember(discordId) {
  return botRequest('DELETE', `/guilds/${await getConfiguredGuildId()}/members/${discordId}`);
}

export async function getGuildMember(discordId) {
  try {
    return await botRequest('GET', `/guilds/${await getConfiguredGuildId()}/members/${discordId}`);
  } catch (error) {
    if (error.message?.includes('Unknown Member')) return null;
    throw error;
  }
}

export async function getActiveRoleId({ forceRefresh = false } = {}) {
  const config = await getDiscordConfig();
  if (config.activeRoleId) return config.activeRoleId;
  const configKey = `${config.guildId}:${config.activeRoleName}`;
  if (cachedActiveRoleId && cachedRoleConfigKey === configKey && !forceRefresh) return cachedActiveRoleId;
  try {
    const roles = await getGuildRoles();
    const role = roles?.find((item) => item.name === config.activeRoleName);
    cachedActiveRoleId = role?.id || null;
    cachedRoleConfigKey = configKey;
    if (!cachedActiveRoleId) console.error(`Discord role "${config.activeRoleName}" not found on the configured server.`);
    return cachedActiveRoleId;
  } catch (error) {
    console.error('Discord getActiveRoleId failed:', error.message);
    return null;
  }
}

export async function exchangeCodeForToken(code) {
  const config = await getDiscordConfig();
  if (!config.enabled || !config.clientId || !config.clientSecret || !config.redirectUri) throw new Error('Discord OAuth is not configured.');
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error_description || body?.error || `Discord token exchange failed (${response.status})`);
  return body;
}

export async function getDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `Discord user lookup failed (${response.status})`);
  return body;
}

export async function buildAuthorizeUrl() {
  const config = await getDiscordConfig();
  if (!config.enabled || !config.clientId || !config.redirectUri) throw new Error('Discord OAuth is not configured.');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'identify guilds.join',
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
