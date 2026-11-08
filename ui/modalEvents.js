let bindings;

// Core closes drawers on press events, before a click handler can protect them.
export function initRecastModalEvents(context, closeHandlers) {
    bindings?.abort();
    bindings = new AbortController();
    const options = { signal: bindings.signal };
    const modalIds = ['recast_diff_modal', 'recast_pass_editor_modal', 'recast_preset_manager_modal'];
    for (const id of [...modalIds, 'recast_diff_backdrop', 'recast_pass_editor_backdrop']) {
        const root = document.getElementById(id);
        for (const type of ['mousedown', 'touchstart', 'click']) {
            root?.addEventListener(type, event => event.stopPropagation(), options);
        }
    }
    document.getElementById('recast_diff_backdrop')?.addEventListener('click', event => {
        if ($('#recast_preset_manager_modal').is(':visible')) {
            // This backdrop belongs to the manager now, not the diff reject callback.
            event.stopImmediatePropagation();
            event.stopPropagation();
        }
    }, { ...options, capture: true });
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || event.isComposing || context.Popup.util.isPopupOpen()) return;
        const visible = modalIds.filter(id => $(`#${id}`).is(':visible'));
        const id = visible.at(-1);
        if (!id) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeHandlers[id]?.();
    }, { ...options, capture: true });
}
