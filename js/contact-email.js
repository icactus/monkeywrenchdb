// Obfuscation deters basic harvesting; it cannot stop bots that execute JavaScript.
// Keep the readable AT/DOT fallback and assemble the address only on activation.
(function () {
    document.querySelectorAll('[data-contact-email]').forEach(function (link) {
        const fallback = link.getAttribute('href');
        link.addEventListener('click', function () {
            link.href = 'mailto:' + atob('aWNhY3R1c211c2ljQGdtYWlsLmNvbQ==');
            // Let the native link action open the mail app, then hide the address again.
            setTimeout(function () {
                link.setAttribute('href', fallback);
            }, 0);
        });
    });
})();
