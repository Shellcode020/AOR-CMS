/* Shared Anarchy Online navigation. Add <div id="site-navigation"></div> where the header belongs. */
(() => {
  const mount = document.getElementById('site-navigation');
  if (!mount) return;

  fetch('partials/navigation.html')
    .then(response => {
      if (!response.ok) throw new Error(`Navigation could not load (${response.status})`);
      return response.text();
    })
    .then(html => {
      mount.innerHTML = html;

      const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
      mount.querySelectorAll('[data-page]').forEach(link => {
        const active = link.dataset.page.toLowerCase() === currentFile;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });

      const menuBtn = mount.querySelector('#menuBtn');
      const closeBtn = mount.querySelector('#closeBtn');
      const mobileNav = mount.querySelector('#mobileNav');

      const closeMenu = () => {
        if (!mobileNav || !menuBtn) return;
        mobileNav.classList.remove('open');
        mobileNav.setAttribute('aria-hidden', 'true');
        menuBtn.setAttribute('aria-expanded', 'false');
      };

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
    })
    .catch(error => {
      console.error('Anarchy Online navigation failed to load:', error);
      mount.innerHTML = '<p class="navigation-error">Navigation could not load. Please refresh the page.</p>';
    });
})();
