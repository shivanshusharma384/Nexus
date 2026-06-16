/* =========================================================
   email-state.js  —  Nexus Multi-Chat — Email State & API
   Requires: helpers.js
   ========================================================= */

(function () {
  NexusApp.isFetchingEmails = false;

  NexusApp.fetchEmails = async function (tab, append = false) {
    if (NexusApp.isFetchingEmails) return { error: 'fetching' };
    if (tab !== 'primary' || !NexusApp.googleToken) {
      return { emails: NexusApp.emailData[tab] || [] };
    }

    if (!append && NexusApp.emailData.primary && NexusApp.emailData.primary.length > 0) {
      return { emails: NexusApp.emailData.primary };
    }

    NexusApp.isFetchingEmails = true;
    try {
      let url = 'http://localhost:4000/api/emails';
      if (append && NexusApp.emailData.nextPageToken) {
        url += '?pageToken=' + encodeURIComponent(NexusApp.emailData.nextPageToken);
      }
      const response = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + NexusApp.googleToken }
      });
      
      if (response.ok) {
        const data = await response.json();
        const emails = data.primary || [];
        NexusApp.emailData.nextPageToken = data.nextPageToken;
        
        if (append) {
          NexusApp.emailData.primary = (NexusApp.emailData.primary || []).concat(emails);
        } else {
          NexusApp.emailData.primary = emails;
        }
        return { emails };
      } else {
        return { error: 'failed' };
      }
    } catch (e) {
      return { error: 'network' };
    } finally {
      NexusApp.isFetchingEmails = false;
    }
  };

  NexusApp.markEmailAsRead = function(emId) {
    if (NexusApp.googleToken && emId && !emId.startsWith('s') && !emId.startsWith('p')) {
      fetch(`http://localhost:4000/api/emails/${emId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NexusApp.googleToken,
          'Content-Type': 'application/json'
        }
      }).catch(() => { /* silent */ });
    }
  };
})();
