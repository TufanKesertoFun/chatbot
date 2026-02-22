const DEFAULT_CHUNK_SIZE = 1400;
const DEFAULT_CHUNK_OVERLAP = 180;
const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_MAX_CRAWL_PAGES = 30;
const SKIP_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico',
  '.pdf', '.zip', '.rar', '.7z', '.mp4', '.mp3', '.avi', '.mov',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
]);

function decodeHtmlEntities(text) {
  if (!text) return '';
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function htmlToText(html) {
  const withoutScripts = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  const withBreaks = withoutScripts
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const stripped = withBreaks.replace(/<[^>]+>/g, ' ');
  return normalizeText(decodeHtmlEntities(stripped));
}

function extractTitle(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return '';
  return normalizeText(decodeHtmlEntities(match[1]));
}

function chunkContent(content, { source, botId, userId, idPrefix = 'web', pageNumber = 1 }) {
  const text = normalizeText(content);
  if (!text) return [];

  const chunks = [];
  let index = 0;
  let start = 0;

  while (start < text.length) {
    const idealEnd = Math.min(start + DEFAULT_CHUNK_SIZE, text.length);
    let end = idealEnd;

    // Prefer splitting on paragraph boundaries for better semantic chunks.
    if (idealEnd < text.length) {
      const boundary = text.lastIndexOf('\n\n', idealEnd);
      if (boundary > start + 400) end = boundary;
    }

    const contentPart = text.slice(start, end).trim();
    if (contentPart) {
      chunks.push({
        id: `${idPrefix}_${index}`,
        content: contentPart,
        metadata: {
          source,
          chunk: index,
          page_number: pageNumber,
          extraction_time: new Date().toISOString(),
          context: '',
          page_summary: '',
          keywords: '',
          bot_id: botId || 'ovobot-admin',
          user_id: userId || null,
        },
      });
      index += 1;
    }

    if (end >= text.length) break;
    start = Math.max(end - DEFAULT_CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function stripHash(url) {
  const parsed = new URL(url);
  parsed.hash = '';
  return parsed.toString();
}

function isLikelyHtmlResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  return contentType.includes('text/html') || contentType.includes('application/xhtml+xml') || contentType === '';
}

function shouldSkipUrl(urlValue) {
  const lower = String(urlValue || '').toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return true;
  for (const ext of SKIP_EXTENSIONS) {
    if (lower.includes(`${ext}?`) || lower.endsWith(ext)) return true;
  }
  return false;
}

function extractLinks(html, baseUrl) {
  const text = String(html || '');
  const links = new Set();
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  let match = hrefRegex.exec(text);
  while (match) {
    try {
      const absolute = new URL(match[1], baseUrl).toString();
      links.add(stripHash(absolute));
    } catch (err) {
      // ignore malformed link
    }
    match = hrefRegex.exec(text);
  }
  return Array.from(links);
}

async function fetchPage(url) {
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; OvoBot/1.0; +https://ovobot.local)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    const err = new Error(`Failed to scrape URL (${response.status})`);
    err.statusCode = response.status;
    throw err;
  }
  if (!isLikelyHtmlResponse(response)) {
    const err = new Error('Unsupported content type for crawling');
    err.statusCode = 415;
    throw err;
  }

  const body = await response.text();
  const markdown = htmlToText(body);
  const title = extractTitle(body) || `Imported from ${url}`;

  if (!markdown) {
    const err = new Error('No extractable text content');
    err.statusCode = 422;
    throw err;
  }

  return {
    markdown,
    title,
    url,
    html: body,
  };
}

async function scrapeUrl(url) {
  const page = await fetchPage(url);
  return {
    markdown: page.markdown,
    title: page.title,
    url: page.url,
    scraping_model: 'native',
  };
}

async function crawlWebsite(startUrl, options = {}) {
  const maxPagesRaw = Number(options.maxPages || DEFAULT_MAX_CRAWL_PAGES);
  const maxPages = Number.isFinite(maxPagesRaw) ? Math.max(1, Math.min(200, maxPagesRaw)) : DEFAULT_MAX_CRAWL_PAGES;
  const start = stripHash(startUrl);
  const startParsed = new URL(start);
  const startHost = startParsed.host;
  const queue = [start];
  const visited = new Set();
  const pages = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current) || shouldSkipUrl(current)) continue;
    visited.add(current);

    try {
      const page = await fetchPage(current);
      pages.push({
        url: page.url,
        title: page.title,
        content: page.markdown,
      });

      const links = extractLinks(page.html, current);
      links.forEach((link) => {
        if (visited.has(link) || shouldSkipUrl(link)) return;
        try {
          const parsed = new URL(link);
          if (parsed.host !== startHost) return;
          if (!queue.includes(link) && queue.length < maxPages * 10) {
            queue.push(link);
          }
        } catch (err) {
          // ignore
        }
      });
    } catch (err) {
      // Continue crawling even if one page fails.
    }
  }

  if (pages.length === 0) {
    const err = new Error('No crawlable pages found');
    err.statusCode = 422;
    throw err;
  }

  return {
    startUrl: start,
    pageCount: pages.length,
    pages,
  };
}

function extractYouTubeVideoId(videoUrl) {
  const value = String(videoUrl || '').trim();
  if (!value) return '';
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/i,
    /(?:youtu\.be\/)([\w-]{11})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return '';
}

async function processYouTube(videoUrl, { botId, userId }) {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) {
    const err = new Error('Invalid YouTube URL');
    err.statusCode = 400;
    throw err;
  }

  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`;
  const oembedResponse = await fetchWithTimeout(oembedUrl, { method: 'GET' });
  if (!oembedResponse.ok) {
    const err = new Error(`Failed to fetch YouTube metadata (${oembedResponse.status})`);
    err.statusCode = oembedResponse.status;
    throw err;
  }
  const oembed = await oembedResponse.json();
  const watchResponse = await fetchWithTimeout(`https://www.youtube.com/watch?v=${videoId}`, {
    method: 'GET',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; OvoBot/1.0; +https://ovobot.local)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
    },
  });
  const watchHtml = watchResponse.ok ? await watchResponse.text() : '';
  const descMatch = watchHtml.match(/"shortDescription":"([\s\S]*?)"/);
  const rawDescription = descMatch?.[1]
    ? descMatch[1]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
    : '';

  const transcriptText = normalizeText([
    oembed?.title ? `Title: ${oembed.title}` : '',
    oembed?.author_name ? `Channel: ${oembed.author_name}` : '',
    rawDescription ? `Description:\n${rawDescription}` : '',
  ].filter(Boolean).join('\n\n'));
  if (!transcriptText) {
    const err = new Error('No processable YouTube text found');
    err.statusCode = 422;
    throw err;
  }

  const chunks = chunkContent(transcriptText, {
    source: videoUrl,
    botId,
    userId,
    idPrefix: `yt_${videoId}`,
  });

  return {
    status: 'success',
    video_url: videoUrl,
    video_id: videoId,
    document_count: chunks.length,
    processing_details: {
      documents: chunks,
      extraction_source: 'youtube-oembed+watch-page',
    },
  };
}

module.exports = {
  scrapeUrl,
  crawlWebsite,
  chunkContent,
  processYouTube,
};
