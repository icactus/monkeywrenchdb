(() => {
    'use strict';
    document.querySelectorAll('.request-preset').forEach(select => {
        select.addEventListener('change', () => {
            if (!select.value) return;
            const form = select.closest('form');
            const message = form.querySelector('textarea[name="message"]');
            if (message.value.trim() && !window.confirm('Replace your current reply with this preset?')) {
                select.value = '';
                return;
            }
            message.value = select.value;
            form.querySelector('.response-status').value = select.selectedOptions[0].dataset.status;
            message.focus();
            const placeholder = /\[(?:timeframe|link)\]/.exec(message.value);
            if (placeholder) message.setSelectionRange(placeholder.index, placeholder.index + placeholder[0].length);
        });
    });
})();
