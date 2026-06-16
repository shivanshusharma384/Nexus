const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

/* ── Helpers ──────────────────────────────────────────────── */

/**
 * URL-safe base64 decode (Gmail uses base64url encoding).
 */
function base64UrlDecode(data) {
  if (!data) return '';
  // Pad with '=' to make length a multiple of 4
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf-8');
}

/**
 * URL-safe base64 encode (for sending emails via Gmail API).
 */
function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Recursively extract plain text and HTML body from payload parts.
 */
function parseEmailPart(parts) {
  let plain = '';
  let html = '';

  for (const part of parts) {
    const mimeType = part.mimeType || '';

    if (mimeType === 'text/plain') {
      const data = (part.body && part.body.data) || '';
      if (data) plain += base64UrlDecode(data);
    } else if (mimeType === 'text/html') {
      const data = (part.body && part.body.data) || '';
      if (data) html += base64UrlDecode(data);
    } else if (part.parts) {
      const [p, h] = parseEmailPart(part.parts);
      plain += p;
      html += h;
    }
  }

  return [plain, html];
}

/**
 * Remove HTML tags for a plain-text fallback.
 */
function stripHtmlTags(htmlStr) {
  let clean = htmlStr;
  // Remove <style> blocks
  clean = clean.replace(/<style[^>]*>.*?<\/style>/gis, '');
  // Remove <script> blocks
  clean = clean.replace(/<script[^>]*>.*?<\/script>/gis, '');
  // <br> → newline
  clean = clean.replace(/<br\s*\/?>/gi, '\n');
  // </p> → double newline
  clean = clean.replace(/<\/p>/gi, '\n\n');
  // </div> → newline
  clean = clean.replace(/<\/div>/gi, '\n');
  // Strip remaining tags
  clean = clean.replace(/<[^>]+>/g, '');
  // Collapse excessive newlines
  clean = clean.replace(/\n{3,}/g, '\n\n');
  return clean.trim();
}

/**
 * Get a specific header value by name (case-insensitive).
 */
function getHeader(headers, name) {
  const lowerName = name.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lowerName) return h.value;
  }
  return '';
}

/**
 * Parse 'Name <email@domain.com>' into a structured object.
 */
function parseAddress(addr) {
  const match = addr.match(/(?:"?([^"]*)"?\s)?<?([^>]*)>?/);
  if (match) {
    const name = (match[1] || match[2] || '').trim();
    const email = (match[2] || '').trim();
    const init = name ? name[0].toUpperCase() : 'M';
    return { name, email, init, color: '#6366f1' };
  }
  return { name: addr, email: addr, init: 'M', color: '#6366f1' };
}

/**
 * Format an email date string into a smart, human-readable format:
 *   - Today:     "10:34 AM"
 *   - Yesterday: "Yesterday"
 *   - This week: "Mon", "Tue", etc.
 *   - This year: "Jun 10"
 *   - Older:     "Dec 5, 2024"
 */
function formatEmailDate(dateStr) {
  if (!dateStr) return '';

  let d;
  try {
    d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
  } catch {
    return dateStr;
  }

  const now = new Date();

  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const emailDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - emailDay) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Today → show time like "10:34 AM"
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    // This week → "Mon", "Tue", etc.
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    // Same year → "Jun 10"
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  // Older → "Dec 5, 2024"
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format a full date+time for the email reader header.
 * e.g. "Mon, Jun 16, 2025, 10:34 AM"
 */
function formatEmailDateFull(dateStr) {
  if (!dateStr) return '';
  let d;
  try {
    d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
  } catch {
    return dateStr;
  }
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/* ── Routes ───────────────────────────────────────────────── */

/**
 * GET /api/emails — Fetch inbox emails (read-only list + detail)
 */
app.get('/api/emails', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const headers = { Authorization: `Bearer ${token}` };
  const pageToken = req.query.pageToken;

  // 1. Fetch list of recent messages from Inbox
  const listParams = new URLSearchParams({
    labelIds: 'INBOX',
    maxResults: '15',
    q: 'newer_than:7d',
  });
  if (pageToken) listParams.set('pageToken', pageToken);

  const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${listParams}`;

  let listRes;
  try {
    listRes = await fetch(listUrl, { headers });
  } catch (err) {
    console.error('GOOGLE API NETWORK ERROR:', err.message);
    return res.status(502).json({ error: 'Failed to reach Gmail API' });
  }

  if (listRes.status !== 200) {
    const errorBody = await listRes.json().catch(() => ({}));
    console.error('GOOGLE API ERROR:', JSON.stringify(errorBody));
    return res.status(listRes.status).json({ error: 'Failed to fetch emails', details: errorBody });
  }

  const listData = await listRes.json();
  const messages = listData.messages || [];
  const nextPageToken = listData.nextPageToken || null;

  // 2. Fetch details for each message concurrently
  const detailResults = await Promise.all(
    messages.map(async (msg) => {
      const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`;
      try {
        const detailRes = await fetch(detailUrl, { headers });
        if (detailRes.status === 200) {
          const data = await detailRes.json();
          return { id: msg.id, data };
        }
      } catch (err) {
        console.error(`Failed to fetch message ${msg.id}:`, err.message);
      }
      return { id: msg.id, data: null };
    })
  );

  // 3. Parse each message
  const parsedEmails = [];

  for (const { id: msgId, data } of detailResults) {
    if (!data) continue;

    const payload = data.payload || {};
    const msgHeaders = payload.headers || [];

    // Extract metadata
    const subject = getHeader(msgHeaders, 'Subject') || '(No Subject)';
    const fromRaw = getHeader(msgHeaders, 'From');
    const toRaw = getHeader(msgHeaders, 'To');
    const dateRaw = getHeader(msgHeaders, 'Date');

    // Parse body — separate plain text and HTML
    let plainBody = '';
    let htmlBody = '';

    if (payload.parts) {
      [plainBody, htmlBody] = parseEmailPart(payload.parts);
    } else {
      // Sometimes there are no parts, just a body data
      const bdata = (payload.body && payload.body.data) || '';
      const mime = payload.mimeType || '';
      if (bdata) {
        const decoded = base64UrlDecode(bdata);
        if (mime === 'text/html') {
          htmlBody = decoded;
        } else {
          plainBody = decoded;
        }
      }
    }

    // Build final body: prefer plain text, fall back to stripped HTML
    const body = plainBody || stripHtmlTags(htmlBody) || data.snippet || '';

    // Check unread/starred
    const labels = data.labelIds || [];
    const isUnread = labels.includes('UNREAD');
    const isStarred = labels.includes('STARRED');

    parsedEmails.push({
      id: msgId,
      from: parseAddress(fromRaw),
      to: toRaw,
      subject,
      snippet: data.snippet || '',
      date: formatEmailDate(dateRaw),
      dateFull: formatEmailDateFull(dateRaw),
      unread: isUnread,
      starred: isStarred,
      body,
      bodyHtml: htmlBody,
    });
  }

  return res.json({
    primary: parsedEmails,
    social: [],
    promo: [],
    nextPageToken,
  });
});

/**
 * POST /api/emails/:id/read — Mark a message as read on Gmail
 * Removes the UNREAD label from the message.
 */
app.post('/api/emails/:id/read', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const messageId = req.params.id;

  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`;

  try {
    const gRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    });

    if (gRes.status === 200) {
      return res.json({ success: true });
    }

    const errBody = await gRes.json().catch(() => ({}));
    console.error('MARK READ ERROR:', JSON.stringify(errBody));
    return res.status(gRes.status).json({ error: 'Failed to mark as read', details: errBody });
  } catch (err) {
    console.error('MARK READ NETWORK ERROR:', err.message);
    return res.status(502).json({ error: 'Failed to reach Gmail API' });
  }
});

/**
 * POST /api/emails/send — Send an email via Gmail API
 * Body: { to: string, subject: string, body: string, inReplyTo?: string, references?: string }
 */
app.post('/api/emails/send', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');
  const { to, subject, body, inReplyTo, references, threadId } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, body' });
  }

  // Build RFC 2822 MIME message
  let mimeHeaders = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];

  // For replies, include In-Reply-To and References headers
  if (inReplyTo) {
    mimeHeaders.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    mimeHeaders.push(`References: ${references}`);
  }

  const mimeMessage = mimeHeaders.join('\r\n') + '\r\n\r\n' + body;
  const encodedMessage = base64UrlEncode(mimeMessage);

  // Build request body
  const sendBody = { raw: encodedMessage };
  if (threadId) {
    sendBody.threadId = threadId;
  }

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

  try {
    const gRes = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendBody),
    });

    if (gRes.status === 200) {
      const data = await gRes.json();
      return res.json({ success: true, messageId: data.id });
    }

    const errBody = await gRes.json().catch(() => ({}));
    console.error('SEND EMAIL ERROR:', JSON.stringify(errBody));
    return res.status(gRes.status).json({ error: 'Failed to send email', details: errBody });
  } catch (err) {
    console.error('SEND EMAIL NETWORK ERROR:', err.message);
    return res.status(502).json({ error: 'Failed to reach Gmail API' });
  }
});

/* ── Start ────────────────────────────────────────────────── */

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Starting Nexus Mail Backend on http://localhost:${PORT}`);
});
