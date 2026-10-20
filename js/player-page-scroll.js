// Scroll the desktop header away before scrolling through the score itself.
(function () {
    const notation = document.getElementById('notation');
    const scroller = document.getElementById('notation-scroll');
    if (!notation || !scroller) return;

    const desktop = window.matchMedia('(min-width: 768px) and (min-height: 501px)');
    let frame = 0;
    let fitTimer;

    function enabled() {
        return desktop.matches && document.body.classList.contains('recording-loaded') &&
            !document.fullscreenElement && !document.webkitFullscreenElement;
    }

    function updateHeight() {
        frame = 0;
        if (!enabled()) {
            notation.style.removeProperty('--score-viewport-height');
            return;
        }
        const top = Math.max(5, notation.getBoundingClientRect().top);
        const height = Math.max(100, window.innerHeight - top - 5) + 'px';
        if (notation.style.getPropertyValue('--score-viewport-height') === height) return;
        notation.style.setProperty('--score-viewport-height', height);

        // Refit spreads after the page stops moving, without rebuilding the PDF.
        clearTimeout(fitTimer);
        if (scroller.classList.contains('two-up')) {
            fitTimer = setTimeout(function () {
                if (enabled() && scroller.classList.contains('two-up') &&
                    typeof resizePageFitToHeight === 'function') resizePageFitToHeight();
            }, 120);
        }
    }

    function scheduleUpdate() {
        if (!frame) frame = requestAnimationFrame(updateHeight);
    }

    scroller.addEventListener('wheel', function (event) {
        if (!enabled() || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
            event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        const distance = notation.getBoundingClientRect().top - 5;
        if (distance <= 1) return;

        // A wheel over the PDF otherwise goes straight into its inner scroller.
        // Keep any distance left over after the header has moved off screen.
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
        const delta = event.deltaY * unit;
        const before = window.scrollY;
        event.preventDefault();
        window.scrollBy(0, Math.min(distance, delta));
        scroller.scrollTop += Math.max(0, delta - (window.scrollY - before));
        scheduleUpdate();
    }, { passive: false });

    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate, { passive: true });
    desktop.addEventListener('change', scheduleUpdate);
    document.addEventListener('fullscreenchange', scheduleUpdate);
    document.addEventListener('webkitfullscreenchange', scheduleUpdate);
    new MutationObserver(scheduleUpdate).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    scheduleUpdate();
})();
