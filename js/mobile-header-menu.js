// Shared mobile-menu behavior for the homepage, player, and account pages.
(() => {
    'use strict';
    const menu = document.getElementById('mobile-header-menu');
    const burger = document.getElementById('mobile-header-burger');
    if (!menu || !burger) return;

    const isOpen = () => getComputedStyle(menu).display !== 'none';
    function closeMenu(restoreFocus = false) {
        menu.style.display = 'none';
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        if (restoreFocus) burger.focus();
    }
    burger.setAttribute('aria-controls', menu.id);
    burger.setAttribute('aria-expanded', String(isOpen()));
    window.toggleMobileHeaderMenu = () => {
        if (isOpen()) closeMenu();
        else {
            menu.style.display = 'flex';
            menu.classList.add('open');
            burger.setAttribute('aria-expanded', 'true');
        }
    };

    function dismissOutside(event) {
        if (isOpen() && !menu.contains(event.target) && !burger.contains(event.target)) closeMenu();
    }
    // Score touch handlers can cancel the subsequent click. Capture the initial
    // interaction without preventing the tap or scroll on the underlying page.
    const options = { capture: true, passive: true };
    if ('PointerEvent' in window) document.addEventListener('pointerdown', dismissOutside, options);
    else {
        document.addEventListener('touchstart', dismissOutside, options);
        document.addEventListener('mousedown', dismissOutside, options);
    }
    document.addEventListener('click', dismissOutside, options);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            closeMenu(true);
        }
    }, true);
})();
