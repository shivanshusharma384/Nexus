/* =========================================================
   email-ui.js  —  Nexus Multi-Chat — Email UI rendering
   Requires: data.js, helpers.js, email-state.js
   ========================================================= */

(function () {
  const app = document.getElementById('app');

  NexusApp.enterEmailMode = function () {
    app.classList.add('email-mode');
    NexusApp.renderInbox('primary');
    lucide.createIcons();
  };

  NexusApp.exitEmailMode = function () {
    app.classList.remove('email-mode');
  };

  NexusApp.renderInbox = async function (tab, append = false) {
    if (NexusApp.isFetchingEmails) return;
    
    NexusApp.activeEmailTab = tab;
    const list = document.getElementById('inboxList');
    if (!list) return;

    if (!append) {
      document.querySelectorAll('.inbox-tab').forEach((t, i) => {
        const tabs = ['primary', 'social', 'promo'];
        t.classList.toggle('active', tabs[i] === tab);
        t.setAttribute('aria-selected', tabs[i] === tab ? 'true' : 'false');
      });
      list.innerHTML = '';
    }

    const loadingDiv = document.createElement('div');
    if (!append && tab === 'primary' && NexusApp.googleToken && (!NexusApp.emailData.primary || NexusApp.emailData.primary.length === 0)) {
      loadingDiv.style.cssText = 'padding: 20px; text-align: center; color: var(--text-3); font-size: 13px;';
      loadingDiv.textContent = 'Fetching your emails...';
      list.appendChild(loadingDiv);
    }

    const result = await NexusApp.fetchEmails(tab, append);

    if (loadingDiv.parentNode === list) {
      list.removeChild(loadingDiv);
    }

    if (result && result.error) {
      if (result.error === 'network' && !append) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-3);">Backend server is not running on port 4000.</div>';
      } else if (result.error === 'failed' && !append) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-3);">Failed to load emails. Re-authenticate or check backend.</div>';
      }
      return;
    }

    const emails = result ? result.emails : [];

    if (!append && emails.length === 0) {
      list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-3);">Inbox is empty.</div>';
      return;
    }

    emails.forEach(em => {
      if (append && document.querySelector(`.email-row[data-email-id="${em.id}"]`)) return;

      const row = document.createElement('div');
      row.className = `email-row${em.unread ? ' unread' : ''}${em.id === NexusApp.activeEmailId ? ' active' : ''}`;
      row.setAttribute('role', 'listitem');
      row.setAttribute('data-email-id', em.id);
      row.innerHTML = `
        <div class="email-av" style="background:${em.from.color};">${em.from.init}</div>
        <div class="email-row-content">
          <div class="email-row-top">
            <span class="email-sender">${NexusApp.escHtml(em.from.name)}</span>
            <span class="email-date">${em.date}</span>
          </div>
          <div class="email-subject-line">${NexusApp.escHtml(em.subject)}</div>
          <div class="email-snippet">${NexusApp.escHtml(em.snippet)}</div>
        </div>
        <div class="email-unread-dot" style="${em.unread ? '' : 'visibility:hidden;'}"></div>
        <div class="email-star${em.starred ? ' starred' : ''}" data-id="${em.id}" title="Star" aria-label="Star">
          <i data-lucide="star" class="lucide" style="fill:${em.starred ? '#fbbf24' : 'none'};"></i>
        </div>
      `;
      row.addEventListener('click', () => NexusApp.openEmail(em));
      list.appendChild(row);
    });

    if (!list.dataset.hasScrollListener) {
      list.addEventListener('scroll', () => {
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 150) {
          if (NexusApp.activeEmailTab === 'primary' && NexusApp.emailData.nextPageToken && !NexusApp.isFetchingEmails) {
            NexusApp.renderInbox('primary', true);
          }
        }
      });
      list.dataset.hasScrollListener = "true";
    }

    lucide.createIcons();
  };

  NexusApp.openEmail = function (em) {
    NexusApp.activeEmailId = em.id;
    NexusApp.activeEmailData = em;
    em.unread = false;

    document.querySelectorAll('.email-row').forEach(r => {
      const isActive = r.dataset.emailId === em.id;
      r.classList.toggle('active', isActive);
      if (isActive) {
        r.classList.remove('unread');
        const dot = r.querySelector('.email-unread-dot');
        if (dot) dot.style.visibility = 'hidden';
      }
    });

    NexusApp.markEmailAsRead(em.id);

    document.getElementById('noEmailPlaceholder').style.display = 'none';
    const ec = document.getElementById('emailContent');
    ec.style.display = 'flex';

    document.getElementById('emailSubjectHeading').textContent = em.subject;
    const thread = document.getElementById('emailThread');
    thread.querySelectorAll('.email-msg-card, .email-thread-divider, .email-quick-actions').forEach(el => el.remove());

    const displayDate = em.dateFull || em.date;

    const card = document.createElement('div');
    card.className = 'email-msg-card';
    card.innerHTML = `
      <div class="email-msg-hdr">
        <div class="email-msg-av" style="background:${em.from.color};">${em.from.init}</div>
        <div class="email-msg-meta">
          <div class="email-msg-from">${NexusApp.escHtml(em.from.name)}</div>
          <div class="email-msg-addr">&lt;${NexusApp.escHtml(em.from.email)}&gt;</div>
          <div class="email-msg-to-row">to <strong>${NexusApp.escHtml(em.to)}</strong></div>
        </div>
        <div class="email-msg-date">
          <span>${displayDate}</span>
          <div class="email-msg-actions-row">
            <button class="email-hdr-icon" title="Star" aria-label="Star">
              <i data-lucide="star" class="lucide" style="fill:${em.starred ? '#fbbf24' : 'none'};color:${em.starred ? '#fbbf24' : 'inherit'};"></i>
            </button>
            <button class="email-hdr-icon" title="Reply" aria-label="Reply">
              <i data-lucide="corner-up-left" class="lucide"></i>
            </button>
            <button class="email-hdr-icon" title="More options" aria-label="More options">
              <i data-lucide="ellipsis-vertical" class="lucide"></i>
            </button>
          </div>
        </div>
      </div>
      <div class="email-msg-body"></div>
    `;

    const bodyEl = card.querySelector('.email-msg-body');

    if (em.bodyHtml) {
      const iframe = document.createElement('iframe');
      iframe.className = 'email-html-frame';
      iframe.setAttribute('sandbox', 'allow-same-origin');
      iframe.setAttribute('title', 'Email content');
      iframe.style.cssText = 'width:100%;border:none;overflow:hidden;min-height:120px;';
      bodyEl.appendChild(iframe);

      requestAnimationFrame(() => {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              html, body {
                margin: 0; padding: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 13.5px;
                line-height: 1.75;
                color: ${isDark ? '#8696a0' : '#4a5270'};
                background: transparent;
                word-break: break-word;
                overflow-wrap: break-word;
              }
              a { color: ${isDark ? '#818cf8' : '#6366f1'}; }
              img { max-width: 100%; height: auto; border-radius: 8px; }
              table { max-width: 100% !important; }
              blockquote {
                border-left: 3px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
                margin: 8px 0; padding: 4px 12px;
                color: ${isDark ? '#667781' : '#8890a8'};
              }
            </style>
          </head>
          <body>${em.bodyHtml}</body>
          </html>
        `);
        doc.close();

        function resizeIframe() {
          try {
            const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
            iframe.style.height = Math.max(h, 80) + 'px';
          } catch(e) { iframe.style.height = '300px'; }
        }
        resizeIframe();
        const imgs = doc.querySelectorAll('img');
        imgs.forEach(img => img.addEventListener('load', resizeIframe));
        setTimeout(resizeIframe, 500);
        setTimeout(resizeIframe, 1500);
      });
    } else {
      bodyEl.textContent = em.body;
      bodyEl.style.whiteSpace = 'pre-wrap';
    }

    thread.appendChild(card);
    if (NexusApp.closeReplyComposer) NexusApp.closeReplyComposer();
    lucide.createIcons();
    thread.scrollTop = 0;
  };

  /* ── Events ─────────────────────────────────────────────── */
  document.querySelectorAll('.inbox-tab').forEach((tab, i) => {
    const tabs = ['primary', 'social', 'promo'];
    tab.addEventListener('click', () => NexusApp.renderInbox(tabs[i]));
  });
})();
