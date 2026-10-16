/* Anarchy Online Discord announcements. Keep your existing working Worker URL. */
(() => {
  'use strict';

  const API_URL = 'https://green-darkness-8d8d.danielprenen.workers.dev/news';
  const REFRESH_MS = 60_000;
  const list = document.getElementById('discordNewsList');
  const viewAll = document.getElementById('discordNewsViewAll');
  if (!list) return;

  const escapeText = (s) => String(s ?? '');

  // Render a safe subset of Discord Markdown using DOM nodes (never inject raw HTML).
  function inlineFormat(parent, text) {
    const tokenPattern = /(https?:\/\/[^\s<>]+|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
    let last = 0;
    let match;
    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > last) parent.append(document.createTextNode(text.slice(last, match.index)));
      const token = match[0];
      let node;
      if (/^https?:\/\//.test(token)) {
        const safeUrl = token.replace(/[),.!?]+$/, '');
        const trailing = token.slice(safeUrl.length);
        try {
          const parsed = new URL(safeUrl);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            node = document.createElement('a');
            node.href = parsed.href;
            node.target = '_blank';
            node.rel = 'noopener noreferrer';
            node.textContent = safeUrl;
            parent.append(node, document.createTextNode(trailing));
          } else parent.append(document.createTextNode(token));
        } catch { parent.append(document.createTextNode(token)); }
      } else if (token.startsWith('**') || token.startsWith('__')) {
        node = document.createElement('strong'); node.textContent = token.slice(2, -2); parent.append(node);
      } else if (token.startsWith('~~')) {
        node = document.createElement('del'); node.textContent = token.slice(2, -2); parent.append(node);
      } else if (token.startsWith('`')) {
        node = document.createElement('code'); node.textContent = token.slice(1, -1); parent.append(node);
      } else {
        node = document.createElement('em'); node.textContent = token.slice(1, -1); parent.append(node);
      }
      last = tokenPattern.lastIndex;
    }
    if (last < text.length) parent.append(document.createTextNode(text.slice(last)));
  }

  function normalizeDiscordText(source) {
    return escapeText(source)
      .replace(/\r\n?/g, '\n')
      // Some feed/API layers return escaped newline sequences instead of actual line breaks.
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n');
  }

  function renderMarkdown(container, source) {
    const text = normalizeDiscordText(source);
    if (!text.trim()) {
      container.textContent = 'This announcement has no text content.';
      return;
    }

    container.replaceChildren();
    const lines = text.split('\n');
    let paragraph = [];
    let listNode = null;
    let listType = '';
    let inCode = false;
    let codeLines = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      const p = document.createElement('p');
      p.className = 'news-paragraph';
      paragraph.forEach((part, i) => {
        if (i) p.append(document.createElement('br'));
        inlineFormat(p, part);
      });
      container.append(p);
      paragraph = [];
    };
    const flushList = () => { listNode = null; listType = ''; };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        flushParagraph(); flushList();
        if (inCode) {
          const pre = document.createElement('pre');
          const code = document.createElement('code');
          code.textContent = codeLines.join('\n');
          pre.append(code); container.append(pre);
          codeLines = []; inCode = false;
        } else {
          inCode = true; codeLines = [];
        }
        continue;
      }

      if (inCode) { codeLines.push(line); continue; }

      // A blank line ends the current paragraph. CSS adds visible spacing between paragraphs.
      if (!trimmed) { flushParagraph(); flushList(); continue; }

      const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
      const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        flushParagraph();
        const wantedType = bullet ? 'ul' : 'ol';
        if (!listNode || listType !== wantedType) {
          flushList();
          listNode = document.createElement(wantedType);
          listType = wantedType;
          container.append(listNode);
        }
        const li = document.createElement('li');
        inlineFormat(li, (bullet || numbered)[1]);
        listNode.append(li);
        continue;
      }

      flushList();
      if (trimmed.startsWith('> ')) {
        flushParagraph();
        const quote = document.createElement('blockquote');
        inlineFormat(quote, trimmed.slice(2));
        container.append(quote);
        continue;
      }

      if (/^#{1,3}\s+/.test(trimmed)) {
        flushParagraph(); flushList();
        const level = Math.min(3, trimmed.match(/^#+/)[0].length);
        const heading = document.createElement(`h${level + 2}`);
        inlineFormat(heading, trimmed.replace(/^#{1,3}\s+/, ''));
        container.append(heading);
        continue;
      }

      // Preserve the text content while treating a non-empty line as part of its paragraph.
      paragraph.push(line.trimEnd());
    }

    if (inCode) {
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.append(code); container.append(pre);
    }
    flushParagraph();
  }

  function dateLabel(timestamp) {
    if (!timestamp) return 'Date unavailable';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date);
  }

  function makeCard(message) {
    const article = document.createElement('article');
    article.className = 'news-item';

    // No thumbnail/logo column: announcements use the full card width.
    const body = document.createElement('div');
    body.className = 'news-body';

    const title = document.createElement('h3');
    title.textContent = message.title || 'Anarchy Online Announcement';
    body.append(title);

    const date = document.createElement('div');
    date.className = 'news-date';
    date.textContent = `${dateLabel(message.timestamp)} · ${message.author || 'Anarchy Online Team'}`;
    body.append(date);

    const content = document.createElement('div');
    content.className = 'news-content';
    renderMarkdown(content, message.content || message.description || '');
    body.append(content);

    if (message.url) {
      const link = document.createElement('a');
      link.className = 'news-read-link';
      link.href = message.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Read more... ↗';
      body.append(link);
    }

    article.append(body);
    return article;
  }

  async function loadNews() {
    if (API_URL.includes('YOUR-WORKER')) {
      list.setAttribute('aria-busy', 'false');
      list.replaceChildren();
      const state = document.createElement('div');
      state.className = 'discord-news-state error';
      state.textContent = 'Set API_URL in discord-news.js to your working Cloudflare Worker /news URL.';
      list.append(state);
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.messages)) throw new Error('Unexpected feed format');

      list.replaceChildren();
      if (!data.messages.length) {
        const state = document.createElement('div');
        state.className = 'discord-news-state';
        state.textContent = 'No announcements have been posted yet.';
        list.append(state);
      } else {
        data.messages.slice(0, 3).forEach((message) => list.append(makeCard(message)));
        if (viewAll && data.messages[0]?.url) viewAll.href = data.messages[0].url;
      }
      list.setAttribute('aria-busy', 'false');
    } catch (error) {
      console.error('Anarchy Online Discord news failed to load:', error);
      list.setAttribute('aria-busy', 'false');
      list.replaceChildren();
      const state = document.createElement('div');
      state.className = 'discord-news-state error';
      state.textContent = 'Announcements are temporarily unavailable. Please check back shortly.';
      list.append(state);
    }
  }

  loadNews();
  window.setInterval(loadNews, REFRESH_MS);
})();
