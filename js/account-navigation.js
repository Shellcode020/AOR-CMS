document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll(
        '.expansion-links .expansion-link'
    );

    function setActiveLink() {
        const currentHash = window.location.hash || '#characters';

        links.forEach((link) => {
            const isActive = link.getAttribute('href') === currentHash;

            link.classList.toggle('active', isActive);

            if (isActive) {
                link.setAttribute('aria-current', 'location');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }

    links.forEach((link) => {
        link.addEventListener('click', () => {
            const targetHash = link.getAttribute('href');

            links.forEach((item) => {
                item.classList.toggle(
                    'active',
                    item.getAttribute('href') === targetHash
                );
            });
        });
    });

    window.addEventListener('hashchange', setActiveLink);

    setActiveLink();
});