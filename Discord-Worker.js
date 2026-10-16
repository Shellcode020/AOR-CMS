/**
 * Anarchy Online Discord Announcements API
 * Cloudflare Worker — Module syntax
 */

const API = 'https://discord.com/api/v10';
const MAX_AGE_SECONDS = 60;
const MESSAGE_LIMIT = 10;

/**
 * CORS
 * Set ALLOWED_ORIGIN to your website origin, for example:
 * https://yourdomain.com
 * Use * only if you intentionally want to allow every origin.
 */
function allowedOrigin(request, env) {
  const requestOrigin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGIN || '*').trim();

  if (configured === '*') {
    return '*';
  }

  // Requests without an Origin header are allowed for non-browser clients.
  if (!requestOrigin) {
    return configured;
  }

  return requestOrigin === configured ? configured : null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, origin, extra = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
    ...(origin ? corsHeaders(origin) : {}),
    ...extra
  };

  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * Clean Discord-specific markup for titles and field labels.
 */
function plainText(value) {
  return String(value || '')
    .replace(/<@!?(\d+)>/g, '@user')
    .replace(/<@&(\d+)>/g, '@role')
    .replace(/<#(\d+)>/g, '#channel')
    .replace(/<t:\d+(?::[tTdDfFR])?>/g, '')
    .trim();
}

/**
 * Find an image attached to a Discord message or embed.
 */
function firstImage(message) {
  const attachments = message.attachments || [];

  const attachment = attachments.find(item =>
    item.content_type?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)(?:\?|$)/i.test(item.url || '')
  );

  if (attachment?.url) {
    return attachment.url;
  }

  for (const embed of message.embeds || []) {
    if (embed.image?.url) {
      return embed.image.url;
    }

    if (embed.thumbnail?.url) {
      return embed.thumbnail.url;
    }
  }

  return null;
}

/**
 * Convert a Discord message into the website announcement format.
 */
function mapMessage(message, env) {
  const embeds = message.embeds || [];

  // Prefer an embed with a title or description.
  const embed = embeds.find(item =>
    item.title || item.description
  ) || {};

  const rawContent = String(message.content || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  const lines = rawContent.split('\n');

  const firstNonEmptyIndex = lines.findIndex(
    line => line.trim() !== ''
  );

  const firstLine = firstNonEmptyIndex >= 0
    ? lines[firstNonEmptyIndex].trim()
    : '';

  // An embed title takes priority over the message's first line.
  const title = plainText(
    embed.title || firstLine || 'Anarchy Online Announcement'
  ).slice(0, 140);

  let content = '';

  if (rawContent) {
    if (
      !embed.title &&
      firstNonEmptyIndex >= 0 &&
      plainText(firstLine).slice(0, 140) === title
    ) {
      // Remove the title line without collapsing paragraph spacing.
      const before = lines.slice(0, firstNonEmptyIndex);
      const after = lines.slice(firstNonEmptyIndex + 1);

      content = [...before, ...after]
        .join('\n')
        .replace(/^\n+/, '')
        .trimEnd();
    } else {
      content = rawContent;
    }
  }

  // Use the embed description if the message has no body.
  if (!content && embed.description) {
    content = String(embed.description)
      .replace(/\r\n?/g, '\n')
      .trim();
  }

  // If there is still no body, use the embed fields.
  if (!content && embed.fields?.length) {
    content = embed.fields
      .map(field => {
        const name = plainText(field.name || '');
        const value = String(field.value || '')
          .replace(/\r\n?/g, '\n')
          .trim();

        if (name && value) {
          return `${name}: ${value}`;
        }

        return name || value;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  // Discord messages may not contain guild_id.
  const guildId = env.DISCORD_GUILD_ID || message.guild_id;

  const discordUrl = guildId
    ? `https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`
    : `https://discord.com/channels/@me/${message.channel_id}/${message.id}`;

  return {
    id: message.id,
    title: title || 'Anarchy Online Announcement',
    content: content.slice(0, 1600),
    description: String(embed.description || '')
      .replace(/\r\n?/g, '\n')
      .slice(0, 1600),
    author:
      message.author?.global_name ||
      message.author?.username ||
      'Anarchy Online Team',
    timestamp: message.timestamp,
    url: discordUrl,
    image: firstImage(message)
  };
}

/**
 * Cloudflare Worker entry point.
 */
export default {
  async fetch(request, env, ctx) {
    const origin = allowedOrigin(request, env);
    const url = new URL(request.url);

    // Reject browser requests from unconfigured origins.
    if (origin === null) {
      return new Response('Forbidden origin', {
        status: 403,
        headers: {
          'Cache-Control': 'no-store',
          'Vary': 'Origin'
        }
      });
    }

    // Handle browser CORS preflight requests.
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    if (request.method !== 'GET') {
      return json(
        { error: 'Method not allowed' },
        405,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }

    // Health check.
    if (url.pathname === '/' || url.pathname === '/health') {
      return json(
        {
          ok: true,
          service: 'Anarchy Online News API'
        },
        200,
        origin
      );
    }

    // Temporary diagnostic endpoint.
    // Remove this route when debugging is finished.
    if (url.pathname === '/debug') {
      if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) {
        return json(
          { error: 'Missing Worker configuration' },
          500,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      }

      try {
        const response = await fetch(
          `${API}/channels/${encodeURIComponent(
            env.DISCORD_CHANNEL_ID
          )}/messages?limit=3`,
          {
            headers: {
              'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
              'Accept': 'application/json'
            }
          }
        );

        if (!response.ok) {
          return json(
            {
              error: 'Discord API request failed',
              status: response.status
            },
            502,
            origin,
            { 'Cache-Control': 'no-store' }
          );
        }

        const rawMessages = await response.json();

        if (!Array.isArray(rawMessages)) {
          return json(
            { error: 'Unexpected response from Discord' },
            502,
            origin,
            { 'Cache-Control': 'no-store' }
          );
        }

        return json(
          {
            messages: rawMessages.map(message => ({
              id: message.id,
              type: message.type,
              content: message.content,
              author: message.author?.username,
              embeds: message.embeds,
              attachments: (message.attachments || []).map(a => ({
                filename: a.filename,
                content_type: a.content_type,
                url: a.url
              })),
              components: message.components,
              flags: message.flags
            }))
          },
          200,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      } catch (error) {
        return json(
          { error: 'Unexpected error retrieving Discord diagnostics' },
          500,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      }
    }

    // Only /news serves announcements.
    if (url.pathname !== '/news') {
      return json(
        { error: 'Not found' },
        404,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }

    // Required Cloudflare Worker variables.
    if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CHANNEL_ID) {
      return json(
        {
          error: 'Missing Worker configuration',
          required: [
            'DISCORD_BOT_TOKEN',
            'DISCORD_CHANNEL_ID'
          ]
        },
        500,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }

    // Cache announcements for 60 seconds.
    const cache = caches.default;

    const cacheKey = new Request(
      `${url.origin}/__discord_news_cache`,
      { method: 'GET' }
    );

    const cached = await cache.match(cacheKey);

    if (cached) {
      const headers = new Headers(cached.headers);

      // Apply the current request's allowed origin.
      Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(cached.body, {
        status: cached.status,
        headers
      });
    }

    try {
      const discordResponse = await fetch(
        `${API}/channels/${encodeURIComponent(
          env.DISCORD_CHANNEL_ID
        )}/messages?limit=${MESSAGE_LIMIT}`,
        {
          headers: {
            'Authorization': `Bot ${env.DISCORD_BOT_TOKEN}`,
            'Accept': 'application/json'
          }
        }
      );

      if (!discordResponse.ok) {
        return json(
          {
            error: 'Could not retrieve Discord announcements',
            upstreamStatus: discordResponse.status
          },
          502,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      }

      const discordMessages = await discordResponse.json();

      if (!Array.isArray(discordMessages)) {
        return json(
          { error: 'Unexpected response from Discord' },
          502,
          origin,
          { 'Cache-Control': 'no-store' }
        );
      }

      const messages = discordMessages
        // Default messages and replies.
        .filter(message =>
          message.type === 0 || message.type === 19
        )
        .map(message => mapMessage(message, env))
        .sort((a, b) => {
          return (
            new Date(b.timestamp).getTime() -
            new Date(a.timestamp).getTime()
          );
        });

      const body = JSON.stringify({
        messages,
        updatedAt: new Date().toISOString()
      });

      // Store a CORS-independent copy in the Cloudflare cache.
      const cacheResponse = new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`
        }
      });

      ctx.waitUntil(cache.put(cacheKey, cacheResponse));

      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${MAX_AGE_SECONDS}`,
          ...corsHeaders(origin)
        }
      });
    } catch (error) {
      return json(
        { error: 'Unexpected error retrieving announcements' },
        500,
        origin,
        { 'Cache-Control': 'no-store' }
      );
    }
  }
};