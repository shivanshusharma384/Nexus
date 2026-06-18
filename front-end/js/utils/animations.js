// ═══════════════════════════════════════════════════════
// ANIMATIONS.JS  —  GSAP Advanced Animations Integration
// ═══════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Only run if GSAP is loaded
  if (typeof gsap === 'undefined') return;

  console.log('GSAP Loaded: Initializing Animations');

  // Global defaults for smooth, premium feel
  gsap.defaults({
    ease: "power3.out",
    duration: 0.4
  });

  // 1. Initial Page Load Animation
  // Stagger nav buttons and sidebar items
  gsap.from('.nav-logo', { y: -20, opacity: 0, duration: 0.6, delay: 0.1 });
  gsap.from('.nav-platform-btn', { 
    x: -20, 
    opacity: 0, 
    stagger: 0.08, 
    duration: 0.5, 
    delay: 0.2 
  });
  
  gsap.from('.sidebar-left .dm-row', {
    x: -20,
    opacity: 0,
    stagger: 0.04,
    duration: 0.4,
    delay: 0.4
  });

  // 2. Chat Message Stagger (Exported globally so it can be called on chat switch)
  window.animateChatMessages = () => {
    const messages = document.querySelectorAll('.msg-wrap');
    if (!messages.length) return;
    
    // Reset any existing inline styles from previous animations to avoid bugs
    gsap.set(messages, { clearProps: "all" });

    gsap.fromTo(messages, 
      { y: 20, opacity: 0 }, 
      { y: 0, opacity: 1, stagger: 0.03, duration: 0.4 }
    );
  };

  // 3. Email List Stagger (Exported globally)
  window.animateEmailList = () => {
    const emails = document.querySelectorAll('.inbox-list .inbox-row, .inbox-list .email-row'); // adjust selector based on DOM
    if (!emails.length) return;

    gsap.set(emails, { clearProps: "all" });
    
    gsap.fromTo(emails, 
      { x: -10, opacity: 0 }, 
      { x: 0, opacity: 1, stagger: 0.05, duration: 0.4 }
    );
  };

  // Intercept the clicks to trigger animations
  // Add listeners to DMs to animate messages when they are clicked
  const dmContainer = document.querySelector('.dm-list');
  if (dmContainer) {
    dmContainer.addEventListener('click', (e) => {
      const row = e.target.closest('.dm-row');
      if (row) {
        // slight delay to let DOM render the chat
        setTimeout(() => {
          if(window.animateChatMessages) window.animateChatMessages();
        }, 50);
      }
    });
  }
});
