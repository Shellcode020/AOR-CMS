
(() => {
  let initialized = false;

  function initializeAccountModal() {
    if (initialized) return;

    const modal = document.getElementById('account-modal');
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const loginForm = document.getElementById('login-form');
    const loginStatus = document.getElementById('login-status');
    const form = document.getElementById('register-form');
    const status = document.getElementById('register-status');
    const submit = document.getElementById('register-submit');

    if (!modal || !loginView || !registerView || !loginForm ||
        !loginStatus || !form || !status || !submit) {
      console.error('[Account] Modal or required form elements are missing.');
      return;
    }

    initialized = true;

    let registrationCsrf = '';
    let registrationTokenRequest = null;

    const showMessage = (element, message, type = '') => {
      element.textContent = message;
      element.className = 'account-status' + (type ? ' ' + type : '');
    };

    async function refreshRegistrationToken() {
      if (registrationTokenRequest) return registrationTokenRequest;

      registrationTokenRequest = (async () => {
        const response = await fetch('api/register.php?action=csrf', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });

        const data = await response.json();

        if (!response.ok || !data.ok || !data.csrf) {
          throw new Error('Could not connect to registration.');
        }

        registrationCsrf = data.csrf;
      })();

      try {
        await registrationTokenRequest;
      } finally {
        registrationTokenRequest = null;
      }
    }

    function switchView(view) {
      const register = view === 'register';

      loginView.hidden = register;
      registerView.hidden = !register;

      showMessage(loginStatus, '');

      if (register) {
        showMessage(status, '');

        refreshRegistrationToken().catch(() => {
          showMessage(
            status,
            'Registration service unavailable. Please try again.',
            'error'
          );
        });

        document.getElementById('register-username')?.focus();
      } else {
        document.getElementById('login-username')?.focus();
      }
    }

    async function openModal(view = 'login') {
      modal.hidden = false;
      document.body.classList.add('account-modal-open');
      switchView(view);

      try {
        await refreshRegistrationToken();
      } catch (_) {
        // Registration displays an error if its token cannot be retrieved.
      }
    }

    function closeModal() {
      modal.hidden = true;
      document.body.classList.remove('account-modal-open');
    }

    function closeMenuIfOpen() {
      const nav = document.getElementById('mobileNav');
      const button = document.getElementById('menuBtn');

      if (nav) {
        nav.classList.remove('open');
        nav.setAttribute('aria-hidden', 'true');
      }

      if (button) button.setAttribute('aria-expanded', 'false');
    }

    // Delegation also supports account links inside the shared navigation.
    document.addEventListener('click', event => {
      const link = event.target.closest(
        '[data-open-account], [data-open-register]'
      );

      if (link) {
        event.preventDefault();
        closeMenuIfOpen();
        openModal(link.hasAttribute('data-open-register') ? 'register' : 'login');
        return;
      }

      if (event.target.closest('[data-close-account]')) {
        closeModal();
        return;
      }

      if (event.target.closest('[data-show-register]')) {
        switchView('register');
        return;
      }

      if (event.target.closest('[data-show-login]')) {
        switchView('login');
      }
    });

    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !modal.hidden) closeModal();
    });

    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;

      const username = loginForm.elements.username.value.trim();
      const password = loginForm.elements.password.value;
      const button = loginForm.querySelector('button[type="submit"]');

      if (button) {
        button.disabled = true;
        button.textContent = 'Signing in…';
      }

      showMessage(loginStatus, '');

      try {
        const tokenResponse = await fetch('api/account.php?action=csrf', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.ok || !tokenData.csrf) {
          throw new Error('Could not start a secure login. Please try again.');
        }

        const response = await fetch('api/account.php', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams({
            action: 'login',
            csrf: tokenData.csrf,
            username,
            password
          })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Login failed.');
        }

        window.location.href = data.redirect || 'account.php';
      } catch (error) {
        showMessage(loginStatus, error.message || 'Login failed. Please try again.', 'error');
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = 'Login';
        }
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      if (!registrationCsrf) {
        showMessage(status, 'Registration security token is unavailable. Please try again.', 'error');

        try {
          await refreshRegistrationToken();
        } catch (_) {
          return;
        }

        if (!registrationCsrf) return;
      }

      if (form.elements.password.value !== form.elements.password_confirm.value) {
        showMessage(status, 'The passwords do not match.', 'error');
        form.elements.password_confirm.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Creating account…';
      showMessage(status, '');

      try {
        const formData = new FormData(form);
        formData.set('csrf', registrationCsrf);

        const response = await fetch('api/register.php', {
          method: 'POST',
          body: new URLSearchParams(formData),
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });

        const data = await response.json();
        registrationCsrf = '';

        if (!response.ok || !data.ok) {
          throw new Error(data.message || 'Registration failed.');
        }

        showMessage(status, data.message || 'Account created successfully.', 'success');
        form.reset();
      } catch (error) {
        showMessage(status, error.message || 'Registration failed. Please try again.', 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = 'Create Account';

        try {
          await refreshRegistrationToken();
        } catch (_) {
          registrationCsrf = '';
        }
      }
    });

    // Preserve links such as index.html?account=register if used elsewhere.
    const accountMode = new URLSearchParams(location.search).get('account');

    if (accountMode === 'login' || accountMode === 'register') {
      openModal(accountMode);
    }

    console.log('[Account] Modal initialized.');
  }


  // Initialize when the shared modal has loaded.
  document.addEventListener('account-modal-ready', () => {
    initializeAccountModal();
  });

  // Also initialize if the modal is already present on the page.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeAccountModal();
    }, { once: true });
  } else {
    initializeAccountModal();
  }

})();
