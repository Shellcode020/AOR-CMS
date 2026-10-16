
(() => {
    const loginPanel = document.getElementById('login-panel');
    const registerPanel = document.getElementById('register-panel');
    const loginForm = document.getElementById('login-form');
    const loginStatus = document.getElementById('login-status');

    if (!loginPanel || !registerPanel) return;

    function showLogin() {
        loginPanel.hidden = false;
        registerPanel.hidden = true;

        if (loginStatus) {
            loginStatus.textContent = '';
            loginStatus.className = 'register-status';
        }

        const username = document.getElementById('login-username');
        if (username) username.focus();
    }

    function showRegister() {
        loginPanel.hidden = true;
        registerPanel.hidden = false;

        const username = document.getElementById('register-username');
        if (username) username.focus();
    }

    document.querySelectorAll('[data-show-register]')
        .forEach(button => {
            button.addEventListener('click', showRegister);
        });

    document.querySelectorAll('[data-show-login]')
        .forEach(button => {
            button.addEventListener('click', showLogin);
        });

    // Account always opens on the login panel.
    document.querySelectorAll('[data-open-register]')
        .forEach(button => {
            button.addEventListener('click', showLogin);
        });

    // Authentication will be connected in the next stage.
    if (loginForm) {
        loginForm.addEventListener('submit', event => {
            event.preventDefault();

            if (loginStatus) {
                loginStatus.textContent =
                    'Login authentication has not been connected yet.';
                loginStatus.className = 'register-status error';
            }
        });
    }

    // Start on login, not registration.
    showLogin();
})();
