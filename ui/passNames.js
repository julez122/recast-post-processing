let frame = 0;
let observer;
const measure = document.createElement('canvas').getContext('2d');

function resizeName(input) {
    const available = input.parentElement?.clientWidth || 0;
    if (!available || !input.getClientRects().length) return;
    const style = getComputedStyle(input);
    measure.font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = input.value || input.placeholder;
    const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const borderX = parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const spacing = (parseFloat(style.letterSpacing) || 0) * Math.max(0, Array.from(text).length - 1);
    const desired = Math.ceil(measure.measureText(text).width + padding + borderX + spacing + 2);
    input.style.width = `${Math.min(available, Math.max(48, desired))}px`;
    input.style.height = '0px';
    input.style.height = `${Math.ceil(input.scrollHeight + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth))}px`;
}

export function schedulePassNameLayout() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
        frame = 0;
        document.querySelectorAll('#recast_pass_list .pass-name, #rc_pe_name_slot .pass-name').forEach(resizeName);
    });
}

export function bindPassName(input) {
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.isComposing) event.preventDefault();
    });
    input.addEventListener('input', event => {
        if (!event.isComposing && /[\r\n]/.test(input.value)) {
            const cursor = input.selectionStart;
            input.value = input.value.replace(/[\r\n]+/g, ' ');
            input.setSelectionRange(Math.min(cursor, input.value.length), Math.min(cursor, input.value.length));
        }
        resizeName(input);
    });
    input.addEventListener('paste', event => {
        const text = event.clipboardData?.getData('text/plain');
        if (text && /[\r\n]/.test(text)) {
            event.preventDefault();
            input.setRangeText(text.replace(/[\r\n]+/g, ' '), input.selectionStart, input.selectionEnd, 'end');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    schedulePassNameLayout();
}

export function initPassNameLayout() {
    observer?.disconnect();
    const widths = new WeakMap();
    observer = new ResizeObserver(entries => {
        for (const entry of entries) {
            if (widths.get(entry.target) !== entry.contentRect.width) {
                widths.set(entry.target, entry.contentRect.width);
                schedulePassNameLayout();
            }
        }
    });
    for (const id of ['recast_settings', 'rc_pe_name_slot']) {
        const target = document.getElementById(id);
        if (target) observer.observe(target);
    }
    window.removeEventListener('resize', schedulePassNameLayout);
    window.addEventListener('resize', schedulePassNameLayout);
    document.fonts?.ready.then(schedulePassNameLayout);
    schedulePassNameLayout();
}
