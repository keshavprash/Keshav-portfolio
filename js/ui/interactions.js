/* Small interface behaviours: footer year and copy-to-clipboard with honest success and failure states. */

export function initInteractions() {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  initCopyEmail();
}

function initCopyEmail() {
  const btn = document.getElementById('copyEmail');
  const out = document.getElementById('copyStatus');
  const addr = document.getElementById('emailAddr');
  if (!btn || !out || !addr) return;

  const email = (btn.dataset.email || addr.textContent || '').trim();
  const label = btn.querySelector('.mailbox__label');
  let reset;

  const say = (msg, kind) => { out.textContent = msg; out.className = 'copy-status' + (kind ? ' ' + kind : ''); };

  const legacyCopy = () => {
    const ta = document.createElement('textarea');
    ta.value = email;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, email.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  };

  const succeeded = () => {
    btn.classList.add('is-done');
    if (label) label.textContent = 'Copied';
    say('Email address copied to your clipboard.');
    clearTimeout(reset);
    reset = setTimeout(() => {
      btn.classList.remove('is-done');
      if (label) label.textContent = 'Copy email';
      say('');
    }, 3200);
  };

  const failed = () => {
    // Never claim a copy that did not happen: select the address so it can be copied by hand.
    try {
      const range = document.createRange();
      range.selectNodeContents(addr);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      say('Your browser blocked copying. The address is selected: press Ctrl or Cmd + C.', 'warn');
    } catch (e) {
      say('Your browser blocked copying. Please select the address above and copy it.', 'warn');
    }
  };

  btn.addEventListener('click', () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(email).then(succeeded).catch(() => (legacyCopy() ? succeeded() : failed()));
    } else if (legacyCopy()) {
      succeeded();
    } else {
      failed();
    }
  });
}
