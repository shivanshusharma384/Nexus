/* =========================================================
   chat-input.js  —  Nexus Multi-Chat — Message Input & Attachments
   Requires: data.js, helpers.js, chat-ui.js
   ========================================================= */

(function () {
  const messageInput   = document.getElementById('messageInput');
  const sendBtn        = document.getElementById('sendBtn');
  const messagesWrap   = document.getElementById('messagesWrap');
  
  // Attachments
  const attachBtn      = document.getElementById('attachBtn');
  const attachMenu     = document.getElementById('attachMenu');
  const attachWrap     = document.getElementById('attachWrap');
  const fileDoc        = document.getElementById('fileDoc');
  const fileImg        = document.getElementById('fileImg');
  const fileVid        = document.getElementById('fileVid');
  const fileAud        = document.getElementById('fileAud');

  /* ── Send & Simulate Reply ──────────────────────────────── */
  function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !NexusApp.activeConvo) return;

    const convo = NexusApp.conversations[NexusApp.activeConvo];
    const time = NexusApp.getTime();
    convo.messages.push({ id: Date.now(), type: 'sent', text, time });

    const isJumbo = NexusApp.isOnlyEmojis(text);
    const bubbleBody = isJumbo ? `<span class="emoji-anim">${text}</span>` : NexusApp.escHtml(text);

    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap sent';
    wrap.innerHTML = `
      <div class="msg-av" style="background:linear-gradient(135deg,#818cf8,#6366f1);">Me</div>
      <div class="bubble sent${isJumbo ? ' jumbo-emoji' : ''}">
        ${bubbleBody}
        <div class="msg-meta">
          <span class="msg-time">${time}</span>
          <span class="msg-check"><i data-lucide="check-check" class="lucide" style="width:13px;height:13px;"></i></span>
        </div>
      </div>
    `;
    messagesWrap.appendChild(wrap);
    messageInput.value = '';
    lucide.createIcons();
    NexusApp.scrollBottom();

    setTimeout(() => showTyping(convo), 800);
    setTimeout(() => { hideTyping(); simulateReply(convo); }, 2200);
  }

  function showTyping(convo) {
    if (NexusApp.typingEl) return;
    NexusApp.typingEl = document.createElement('div');
    NexusApp.typingEl.className = 'typing-wrap';
    NexusApp.typingEl.id = 'typingIndicator';
    NexusApp.typingEl.innerHTML = `
      <div class="msg-av" style="background:${convo.avatarBg};">${convo.avatarInit}</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messagesWrap.appendChild(NexusApp.typingEl);
    NexusApp.scrollBottom();
  }

  function hideTyping() {
    if (NexusApp.typingEl) { NexusApp.typingEl.remove(); NexusApp.typingEl = null; }
  }

  function simulateReply(convo) {
    if (!NexusApp.activeConvo) return;
    const text = NexusApp.autoReplies[Math.floor(Math.random() * NexusApp.autoReplies.length)];
    const time = NexusApp.getTime();
    convo.messages.push({ id: Date.now(), type: 'received', text, time });

    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap received';
    wrap.innerHTML = `
      <div class="msg-av" style="background:${convo.avatarBg};">${convo.avatarInit}</div>
      <div class="bubble received">
        ${NexusApp.escHtml(text)}
        <div class="msg-meta">
          <span class="msg-time">${time}</span>
        </div>
      </div>
    `;
    messagesWrap.appendChild(wrap);
    lucide.createIcons();
    NexusApp.scrollBottom();
  }

  sendBtn?.addEventListener('click', sendMessage);
  messageInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* ── Emoji Picker ───────────────────────────────────────── */
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPickerPopup = document.getElementById('emojiPickerPopup');
  if (emojiBtn && emojiPickerPopup) {
    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = emojiPickerPopup.style.display === 'block';
      emojiPickerPopup.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!emojiPickerPopup.contains(e.target) && e.target !== emojiBtn) {
        emojiPickerPopup.style.display = 'none';
      }
    });

    const picker = document.querySelector('emoji-picker');
    if (picker) {
      picker.addEventListener('emoji-click', event => {
        messageInput.value += event.detail.unicode;
        messageInput.focus();
      });
    }
  }

  /* ── Attachments Menu ───────────────────────────────────── */
  function closeAttachMenu() { attachMenu.classList.remove('open'); attachMenu.setAttribute('aria-hidden', 'true'); }
  attachBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenu.classList.toggle('open');
    attachMenu.setAttribute('aria-hidden', attachMenu.classList.contains('open') ? 'false' : 'true');
  });
  document.addEventListener('click', (e) => {
    if (attachWrap && !attachWrap.contains(e.target)) closeAttachMenu();
  });

  document.getElementById('attachDoc')?.addEventListener('click', () => { closeAttachMenu(); fileDoc.click(); });
  document.getElementById('attachImg')?.addEventListener('click', () => { closeAttachMenu(); fileImg.click(); });
  document.getElementById('attachVid')?.addEventListener('click', () => { closeAttachMenu(); fileVid.click(); });
  document.getElementById('attachAud')?.addEventListener('click', () => { closeAttachMenu(); fileAud.click(); });

  [fileDoc, fileImg, fileVid, fileAud].forEach((input) => {
    if (!input) return;
    const type = input.id.replace('file', '').toLowerCase(); // doc, img, vid, aud
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file || !NexusApp.activeConvo) { input.value = ''; return; }
      
      const url = URL.createObjectURL(file);
      const convo = NexusApp.conversations[NexusApp.activeConvo];
      const time = NexusApp.getTime();
      const size = NexusApp.formatBytes(file.size);
      const ext = file.name.split('.').pop().toUpperCase();
      let bubbleInner = '';

      if (type === 'img') {
        bubbleInner = `<div class="attach-img-wrap"><img src="${url}" alt="${NexusApp.escHtml(file.name)}" loading="lazy" /><div class="attach-img-overlay"><i data-lucide="zoom-in" class="lucide"></i></div></div>`;
      } else if (type === 'vid') {
        bubbleInner = `<div class="attach-video-wrap"><video src="${url}" controls preload="metadata"></video></div><p style="font-size:11.5px;margin:0;opacity:.7;">${NexusApp.escHtml(file.name)}</p>`;
      } else if (type === 'aud') {
        bubbleInner = `<div class="attach-audio-wrap"><div class="audio-icon"><i data-lucide="music" class="lucide"></i></div><audio src="${url}" controls preload="metadata"></audio></div><p style="font-size:11px;margin:2px 0 0;opacity:.7;">${NexusApp.escHtml(file.name)}</p>`;
      } else {
        bubbleInner = `<a class="attach-doc-chip" href="${url}" download="${NexusApp.escHtml(file.name)}" title="Download ${NexusApp.escHtml(file.name)}"><div class="doc-chip-icon"><i data-lucide="file-text" class="lucide"></i></div><div class="doc-chip-info"><div class="doc-chip-name">${NexusApp.escHtml(file.name)}</div><div class="doc-chip-meta">${size}</div></div><span class="doc-chip-ext">${NexusApp.escHtml(ext)}</span></a>`;
      }

      const wrap = document.createElement('div');
      wrap.className = 'msg-wrap sent';
      wrap.innerHTML = `<div class="msg-av" style="background:linear-gradient(135deg,#818cf8,#6366f1);">Me</div><div class="bubble sent">${bubbleInner}<div class="msg-meta"><span class="msg-time">${time}</span><span class="msg-check"><i data-lucide="check-check" class="lucide" style="width:13px;height:13px;"></i></span></div></div>`;
      
      messagesWrap.appendChild(wrap);
      lucide.createIcons();
      NexusApp.scrollBottom();
      convo.messages.push({ id: Date.now(), type: 'sent', attachType: type, fileName: file.name, size, time });
      input.value = '';
    });
  });

})();
