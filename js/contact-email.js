// Obfuscation deters basic harvesting; it cannot stop bots that execute JavaScript.
// Keep the readable AT/DOT fallback and assemble the address only on activation.
(function () {
    document.querySelectorAll('[data-contact-email]').forEach(function (link) {
        const fallback = link.getAttribute('href');
        link.addEventListener('click', function () {
            link.href = 'mailto:' + atob('bW9ua2V5d3JlbmNoZGJAZ21haWwuY29t');
            // Let the native link action open the mail app, then hide the address again.
            setTimeout(function () {
                link.setAttribute('href', fallback);
            }, 0);
        });
    });
})();
