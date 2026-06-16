/* =========================================================
   email-compose.js  —  Nexus Multi-Chat — Email Composer
   Requires: helpers.js
   ========================================================= */

(function () {
  NexusApp.openReplyComposer = function () {
    if (!NexusApp.activeEmailData) return;
    const composer = document.getElementById('replyComposer');
    const quickActions = document.getElementById('emailQuickActions');
    document.getElementById('replyTo').textContent = NexusApp.activeEmailData.from.email;
    document.getElementById('replySubject').textContent = 'Re: ' + NexusApp.activeEmailData.subject;
    document.getElementById('replyTextarea').value = '';
    composer.style.display = 'block';
    quickActions.style.display = 'none';
    document.getElementById('replyTextarea').focus();
    lucide.createIcons();
  };

  NexusApp.closeReplyComposer = function () {
    const composer = document.getElementById('replyComposer');
    const quickActions = document.getElementById('emailQuickActions');
    if (composer) composer.style.display = 'none';
    if (quickActions) quickActions.style.display = 'flex';
  };

  /* ── Send reply via Gmail API ──────────────────────────── */
  async function sendReply() {
    const body = document.getElementById('replyTextarea').value.trim();
    if (!body) return;
    if (!NexusApp.googleToken) {
      NexusApp.showEmailToast('⚠️ Not authenticated. Please sign in again.');
      return;
    }

    const em = NexusApp.activeEmailData;
    if (!em) return;

    const sendBtn = document.getElementById('replySendBtn');
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.6';

    try {
      const response = await fetch('http://localhost:4000/api/emails/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NexusApp.googleToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: em.from.email,
          subject: 'Re: ' + em.subject,
          body: body,
          threadId: em.id
        })
      });

      if (response.ok) {
        NexusApp.closeReplyComposer();
        NexusApp.showEmailToast('✅ Reply sent successfully');
      } else {
        const errData = await response.json().catch(() => ({}));
        NexusApp.showEmailToast('❌ Failed to send: ' + (errData.error || 'Unknown error'));
      }
    } catch (e) {
      NexusApp.showEmailToast('❌ Network error — is the backend running?');
    } finally {
      sendBtn.disabled = false;
      sendBtn.style.opacity = '';
    }
  }

  /* ── Compose new email ─────────────────────────────────── */
  NexusApp.openComposeModal = function () {
    const overlay = document.getElementById('composeOverlay');
    if (!overlay) return;
    // Reset fields
    document.getElementById('composeTo').value = '';
    document.getElementById('composeSubject').value = '';
    document.getElementById('composeBody').value = '';
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.getElementById('composeTo').focus();
    lucide.createIcons();
  };

  NexusApp.closeComposeModal = function () {
    const overlay = document.getElementById('composeOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  };

  async function sendComposedEmail() {
    const to = document.getElementById('composeTo').value.trim();
    const subject = document.getElementById('composeSubject').value.trim();
    const body = document.getElementById('composeBody').value.trim();

    if (!to) {
      NexusApp.showEmailToast('⚠️ Please enter a recipient');
      return;
    }
    if (!subject) {
      NexusApp.showEmailToast('⚠️ Please enter a subject');
      return;
    }
    if (!body) {
      NexusApp.showEmailToast('⚠️ Please enter a message body');
      return;
    }
    if (!NexusApp.googleToken) {
      NexusApp.showEmailToast('⚠️ Not authenticated. Please sign in again.');
      return;
    }

    const sendBtn = document.getElementById('composeSendBtn');
    sendBtn.disabled = true;
    sendBtn.querySelector('span').textContent = 'Sending…';

    try {
      const response = await fetch('http://localhost:4000/api/emails/send', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NexusApp.googleToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ to, subject, body })
      });

      if (response.ok) {
        NexusApp.closeComposeModal();
        NexusApp.showEmailToast('✅ Email sent successfully');
      } else {
        const errData = await response.json().catch(() => ({}));
        NexusApp.showEmailToast('❌ Failed to send: ' + (errData.error || 'Unknown error'));
      }
    } catch (e) {
      NexusApp.showEmailToast('❌ Network error — is the backend running?');
    } finally {
      sendBtn.disabled = false;
      sendBtn.querySelector('span').textContent = 'Send';
    }
  }

  /* ── Events ─────────────────────────────────────────────── */
  document.getElementById('replyBtn')?.addEventListener('click', NexusApp.openReplyComposer);
  document.getElementById('replyAllBtn')?.addEventListener('click', NexusApp.openReplyComposer);
  document.getElementById('replyClose')?.addEventListener('click', NexusApp.closeReplyComposer);
  document.getElementById('replyDiscardBtn')?.addEventListener('click', NexusApp.closeReplyComposer);
  document.getElementById('replySendBtn')?.addEventListener('click', sendReply);

  document.getElementById('composeBtn')?.addEventListener('click', NexusApp.openComposeModal);
  document.getElementById('composeClose')?.addEventListener('click', NexusApp.closeComposeModal);
  document.getElementById('composeDiscardBtn')?.addEventListener('click', NexusApp.closeComposeModal);
  document.getElementById('composeSendBtn')?.addEventListener('click', sendComposedEmail);

  // Close compose on backdrop click
  document.getElementById('composeOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'composeOverlay') NexusApp.closeComposeModal();
  });
})();
