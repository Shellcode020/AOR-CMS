(() => {
  const menuBtn = document.getElementById('menuBtn');
  const closeBtn = document.getElementById('closeBtn');
  const mobileNav = document.getElementById('mobileNav');

  function closeMenu() {
    if (!mobileNav || !menuBtn) return;
    mobileNav.classList.remove('open');
    mobileNav.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      mobileNav.classList.add('open');
      mobileNav.setAttribute('aria-hidden', 'false');
      menuBtn.setAttribute('aria-expanded', 'true');
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (mobileNav) mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
})();
