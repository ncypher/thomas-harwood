(() => {
  const root = document.getElementById('foundry-lab');
  if (!root) return;
  const q = s => root.querySelector(s);
  const form = q('#foundry-form'), input = q('#foundry-workflow'), submit = q('#foundry-submit');
  const sample = q('#foundry-sample'), status = q('#foundry-status'), output = q('.fl-output');
  const result = q('#foundry-result'), empty = q('#foundry-empty');
  let apiUrl = '', current = null, busy = false;
  try {
    const configured = window.HARWOOD_FOUNDRY_CONFIG?.apiUrl;
    if (configured) {
      const url = new URL(configured);
      if (url.protocol === 'https:' && url.pathname === '/api/foundry' && !url.username && !url.password && !url.search && !url.hash) apiUrl = url.href;
    }
  } catch { /* Invalid configuration leaves the honest sample mode available. */ }
  if (apiUrl) {
    submit.disabled = false; submit.textContent = 'Put it through the foundry ↗';
    q('.fl-mode').textContent = 'AI CONCEPT LAB';
    status.textContent = 'One workflow. One useful starting point.';
  }
  const demoWorkflow = 'Our field team sends job photos in a group chat. Someone matches them to jobs, updates a spreadsheet, and emails the customer. Photos get missed and the office keeps chasing people.';
  const demo = {
    title: 'From scattered photos to a review-ready job record',
    field: 'Field technicians',
    platforms: [{name: 'Job records', stakeholder: 'Operations coordinator'}, {name: 'Customer updates', stakeholder: 'Account manager'}],
    disconnect: 'Photos arrive without a reliable link to the job. The office has to reconstruct the story before anyone can use it.',
    missingLayer: 'A mobile intake form could attach each photo to a job ID, collect a short note, and place the evidence in a shared review queue.',
    humanCheckpoint: 'A coordinator checks the evidence and approves the customer-facing summary before it is sent.',
    firstVersion: 'Pilot one photo form and one review queue with a single team. Confirm that the job system supports an integration before adding automation.'
  };
  function announce(message, error = false) { status.textContent = message; status.classList.toggle('fl-error', error); }
  function render(concept, source) {
    const keys = ['title', 'field', 'disconnect', 'missingLayer', 'humanCheckpoint', 'firstVersion'];
    if (!concept || keys.some(k => typeof concept[k] !== 'string' || !concept[k].trim() || concept[k].length > 500) || !Array.isArray(concept.platforms) || concept.platforms.length < 2 || concept.platforms.length > 3 || concept.platforms.some(p => !p || typeof p.name !== 'string' || typeof p.stakeholder !== 'string' || p.name.length > 45 || p.stakeholder.length > 45)) throw new Error('The concept could not be displayed. Please try later.');
    current = {concept, source};
    q('#foundry-provenance').textContent = source === 'ai' ? 'AI-generated concept · review before building' : 'Sample concept · written example, not an AI response';
    q('#foundry-result-title').textContent = concept.title;
    for (const key of keys.slice(1)) q('#foundry-' + key).textContent = concept[key];
    const platforms = q('#foundry-platforms'); platforms.replaceChildren();
    for (const item of concept.platforms) {
      const row = document.createElement('div'), name = document.createElement('b'), stakeholder = document.createElement('small');
      name.textContent = item.name; stakeholder.textContent = '→ ' + item.stakeholder;
      row.append(name, stakeholder); platforms.append(row);
    }
    empty.hidden = true; result.hidden = false;
  }
  sample.addEventListener('click', () => {
    if (busy) return;
    input.value = demoWorkflow; render(demo, 'sample');
    announce('Sample loaded. No description was sent and no API call was made.');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !apiUrl || !form.reportValidity()) return;
    const workflow = input.value.trim();
    if (workflow.length < 20) { announce('Add a little more detail—at least 20 characters.', true); input.focus(); return; }
    busy = true; current = null; result.hidden = true; empty.hidden = false;
    output.setAttribute('aria-busy', 'true'); submit.disabled = true; sample.disabled = true;
    submit.textContent = 'Shaping your concept…'; announce('Looking for the missing connection…');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(apiUrl, {method: 'POST', credentials: 'omit', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({workflow}), signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The foundry is unavailable. Please try the sample.');
      if (data.source !== 'ai') throw new Error('The response could not be verified as a live concept.');
      render(data.concept, 'ai'); announce('Your concept is ready. Treat it as a starting point to explore.');
    } catch (error) {
      announce(error.name === 'AbortError' ? 'That request took too long. Try later or explore the sample.' : error.message || 'Unable to connect. Try the sample.', true);
    } finally {
      clearTimeout(timer); busy = false; output.setAttribute('aria-busy', 'false');
      submit.disabled = false; sample.disabled = false; submit.textContent = 'Put it through the foundry ↗';
    }
  });
  q('#foundry-copy').addEventListener('click', async () => {
    if (!current) return;
    const c = current.concept;
    const text = `${c.title}\n${current.source === 'ai' ? 'AI-generated concept' : 'Sample concept'}\n\nWhere it breaks: ${c.disconnect}\n\nWhat to build: ${c.missingLayer}\n\nHuman checkpoint: ${c.humanCheckpoint}\n\nFirst version: ${c.firstVersion}\n\nInformation flow: ${c.field} → missing layer → ${c.platforms.map(p => p.name + ' → ' + p.stakeholder).join('; ')}\n\nA starting hypothesis, not a verified implementation plan.\nhttps://thomas-harwood.com/#foundry-lab`;
    try { await navigator.clipboard.writeText(text); announce('Concept copied.'); }
    catch { announce('Copy is unavailable here. You can select and copy the concept text.', true); }
  });
})();
