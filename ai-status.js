/* Shared with cuREOsitylabs/ai-status.js. Public checks never invoke Gemini. */
(() => {
  const labels = {
    available: 'AI available', quota: 'AI usage limit reached',
    unavailable: 'AI temporarily unavailable', disabled: 'AI is paused',
    unknown: 'AI not verified recently'
  };
  const widgets = [...document.querySelectorAll('[data-ai-status]')];
  const refreshers = widgets.map(root => {
    const label = root.querySelector('[data-ai-label]');
    const detail = root.querySelector('[data-ai-detail]');
    const button = root.querySelector('button');
    let busy = false, expiry;
    async function refresh() {
      if (busy) return;
      busy = true; button.disabled = true; clearTimeout(expiry);
      label.textContent = 'Checking AI status…';
      root.dataset.state = 'unknown'; detail.textContent = '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(root.dataset.aiStatus, {credentials:'omit', cache:'no-store', signal:controller.signal});
        if (!response.ok) throw new Error('status unavailable');
        const data = await response.json();
        if (!Object.hasOwn(labels, data.status)) throw new Error('invalid status');
        let state = data.status;
        const age = typeof data.checkedAt === 'number' ? Date.now() - data.checkedAt : Infinity;
        if (state === 'available' && (age < 0 || age >= 300000)) state = 'unknown';
        label.textContent = labels[state]; root.dataset.state = state;
        detail.textContent = state === 'unknown' ? 'The next AI request will verify the connection.' :
          (Number.isFinite(age) ? 'Last checked ' + new Date(data.checkedAt).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + '. Availability can change.' : '');
        if (Number.isFinite(age) && age >= 0 && age < 300000) expiry = setTimeout(() => {
          label.textContent = labels.unknown; root.dataset.state = 'unknown';
          detail.textContent = 'The last check is over five minutes old. Refresh status or try an AI request.';
        }, 300000 - age);
      } catch {
        label.textContent = 'AI status unavailable'; root.dataset.state = 'unknown';
        detail.textContent = 'The connection has not been verified. You can still try an AI request.';
      } finally { clearTimeout(timer); busy = false; button.disabled = false; }
    }
    button.addEventListener('click', refresh);
    refresh();
    return refresh;
  });
  window.AIConnectionStatus = {refresh: () => Promise.all(refreshers.map(refresh => refresh()))};
})();
