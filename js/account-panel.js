(() => {
  const api = 'api/account.php';
  let csrf = '';
  async function getCsrf() {
    const r = await fetch(`${api}?action=csrf`, {credentials:'same-origin',headers:{Accept:'application/json'}});
    const d = await r.json();
    if (!r.ok || !d.ok || !d.csrf) throw new Error(d.message || 'Security token unavailable. Refresh the page.');
    csrf = d.csrf;
    return csrf;
  }
  async function post(action, fields = {}) {
    if (!csrf) await getCsrf();
    const r = await fetch(api, {method:'POST',credentials:'same-origin',headers:{Accept:'application/json'},body:new URLSearchParams({action,csrf,...fields})});
    const d = await r.json();
    if (!r.ok || !d.ok) throw new Error(d.message || 'The request failed.');
    return d;
  }
  function message(el, text, good = false) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('success', good);
    el.classList.toggle('error', !good && !!text);
  }
  document.getElementById('profile-form')?.addEventListener('submit', async e => {
    e.preventDefault(); const f=e.currentTarget, out=document.getElementById('profile-message'), data=new FormData(f);
    message(out,'Saving…');
    try { const d=await post('profile',{email:data.get('email'),first_name:data.get('first_name'),last_name:data.get('last_name')}); message(out,d.message,true); }
    catch(err) { message(out,err.message); }
  });
  document.getElementById('password-form')?.addEventListener('submit', async e => {
    e.preventDefault(); const f=e.currentTarget, out=document.getElementById('password-message'), data=new FormData(f);
    if(data.get('new_password')!==data.get('confirm_password')) { message(out,'The new passwords do not match.'); return; }
    message(out,'Updating…');
    try { const d=await post('password',{current_password:data.get('current_password'),new_password:data.get('new_password'),confirm_password:data.get('confirm_password')}); f.reset(); csrf=''; message(out,d.message,true); await getCsrf(); }
    catch(err) { message(out,err.message); }
  });
  document.querySelectorAll('.unstuck-button').forEach(button => button.addEventListener('click', async () => {
    const name=button.dataset.characterName||'this character';
    if(!window.confirm(`Move ${name} to the unstuck location? Make sure the character is logged out first.`)) return;
    const out=document.getElementById('character-message'); button.disabled=true; message(out,`Moving ${name}…`);
    try { const d=await post('unstuck',{character_id:button.dataset.characterId}); message(out,d.message,true); window.setTimeout(()=>window.location.reload(),900); }
    catch(err) { message(out,err.message); button.disabled=false; }
  }));
  async function logout() {
    try { await post('logout'); window.location.href='index.html'; }
    catch(err) { window.alert(err.message); }
  }
  document.getElementById('logout-button')?.addEventListener('click', logout);
  document.getElementById('logout-button-mobile')?.addEventListener('click', logout);
  getCsrf().catch(err => window.alert(err.message));
})();
