import { missingConnections, parsePresetFile, preparePassTransfer, preparePresetImport } from '../settings/presetTools.js';

const node = (tag, className, text) => {
    const result = document.createElement(tag);
    result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
};
const button = (className, text, action) => {
    const result = node('button', `menu_button ${className}`, text);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
};
const option = (select, text, value) => select.appendChild(new Option(text, value));

export function availableProfiles(context) {
    if (context.extensionSettings.disabledExtensions?.includes('connection-manager')) return [];
    return context.extensionSettings.connectionManager?.profiles || [];
}

function dialog(context, content, className, returnFocus) {
    const popup = new context.Popup(content, context.POPUP_TYPE.DISPLAY, '', {
        leftAlign: true,
        onClose: () => {
            if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
        },
    });
    popup.dlg.classList.add('rc-tools-dialog', className);
    popup.dlg.setAttribute('aria-label', content.querySelector('.rc-tools-title').textContent);
    return popup;
}

export async function showPassTransfer({ context, sourceName, passId, getPresets, commit }) {
    const initial = getPresets();
    const original = initial.find(p => p.name === sourceName)?.passes.find(p => p.id === passId);
    if (!original) throw new Error('The source pass no longer exists.');
    const initialPass = JSON.stringify(original);
    const root = node('div', 'rc-tools-root rc-transfer-root');
    root.append(node('h3', 'rc-tools-title', 'Move/Copy to…'));
    root.append(node('p', 'rc-tools-description', `Choose the presets you want to move or copy “${original.name}” to:`));
    const list = node('div', 'rc-transfer-list');
    const checks = [];
    for (const preset of initial) {
        const row = node('label', 'rc-transfer-preset-row');
        const check = node('input', 'rc-transfer-preset-check');
        check.type = 'checkbox';
        check.value = preset.name;
        check.disabled = preset.name === sourceName;
        row.append(check, node('span', 'rc-transfer-preset-name', preset.name));
        if (check.disabled) row.append(node('small', 'rc-transfer-current', 'Current preset'));
        else checks.push(check);
        list.append(row);
    }
    const error = node('p', 'rc-tools-error');
    error.setAttribute('role', 'alert');
    const footer = node('div', 'rc-tools-footer');
    let popup;
    const cancel = button('rc-tools-cancel', 'Cancel', () => popup.complete(null));
    const copy = button('rc-transfer-copy', 'Copy', () => transfer(false));
    const move = button('rc-transfer-move', 'Move', () => transfer(true));
    const toggle = button('rc-transfer-select-all', 'Select all', () => {
        const all = checks.every(check => check.checked);
        checks.forEach(check => { check.checked = !all; });
        update();
    });
    function update() {
        const any = checks.some(check => check.checked);
        copy.disabled = move.disabled = !any;
        toggle.disabled = !checks.length;
        toggle.textContent = checks.length && checks.every(check => check.checked) ? 'Deselect all' : 'Select all';
    }
    function transfer(isMove) {
        try {
            const current = getPresets();
            if (JSON.stringify(current.find(p => p.name === sourceName)?.passes.find(p => p.id === passId)) !== initialPass) {
                throw new Error('The source pass changed. Please reopen Move/Copy to….');
            }
            const names = checks.filter(check => check.checked).map(check => check.value);
            const result = preparePassTransfer(current, sourceName, passId, names, isMove);
            copy.disabled = move.disabled = true;
            commit(result);
            popup.complete(1);
            toastr.success(`Pass ${isMove ? 'moved' : 'copied'} to ${names.length} preset${names.length === 1 ? '' : 's'}.`);
        } catch (problem) {
            error.textContent = problem.message;
            update();
        }
    }
    checks.forEach(check => check.addEventListener('change', update));
    footer.append(cancel, copy, move);
    root.append(list, toggle);
    root.append(node('small', 'rc-transfer-move-note', checks.length
        ? `Move removes this pass from “${sourceName}” after adding it to every selected preset.`
        : 'Create another preset in Manage Presets before copying or moving a pass.'));
    root.append(error, footer);
    update();
    popup = dialog(context, root, 'rc-transfer-dialog', document.activeElement);
    await popup.show();
}

function previewPreset(preset, side, profiles) {
    const panel = node('section', 'rc-import-preview-side');
    panel.dataset.side = side;
    panel.id = `rc-import-${side}-preview`;
    panel.append(node('h4', 'rc-import-preview-side-title', side === 'existing' ? 'Existing' : 'Incoming'));
    if (!preset) {
        panel.append(node('p', 'rc-import-preview-empty', 'No existing preset.'));
        return panel;
    }
    if (!preset.passes.length) panel.append(node('p', 'rc-import-preview-empty', 'This preset has no passes.'));
    for (const [index, pass] of preset.passes.entries()) {
        const details = node('details', 'rc-import-preview-pass');
        details.append(node('summary', 'rc-import-preview-pass-name', `${index + 1}. ${pass.name || '(unnamed pass)'}`));
        const info = node('dl', 'rc-import-preview-settings');
        const values = [
            ['Connection', pass.connection ? profiles.find(p => p.id === pass.connection)?.name || `Missing: ${pass.connection}` : 'Same as Current'],
            ['Context length', pass.contextLength], ['Enabled', pass.enabled ? 'Yes' : 'No'],
            ['World Info', pass.injectWorldInfo ? 'Yes' : 'No'], ['WI outlets', pass.injectWIOutlets ? 'Yes' : 'No'],
            ['Character card', pass.includeCharCard ? 'Yes' : 'No'], ['Scene context', pass.includeSceneContext ? 'Yes' : 'No'],
            ['Prefill role', pass.prefillRole || 'assistant'], ['Pass ID', pass.id],
        ];
        for (const [label, value] of values) {
            info.append(node('dt', 'rc-import-preview-setting-label', label), node('dd', 'rc-import-preview-setting-value', String(value)));
        }
        details.append(node('h5', 'rc-import-preview-prompt-label', 'Prompt'), node('pre', 'rc-import-preview-prompt', pass.prompt));
        details.append(node('h5', 'rc-import-preview-prefill-label', 'Prefill'), node('pre', 'rc-import-preview-prefill', pass.prefill || '(empty)'));
        const settings = node('details', 'rc-import-preview-options');
        settings.append(node('summary', 'rc-import-preview-options-title', 'Pass settings'), info);
        details.append(settings);
        panel.append(details);
    }
    return panel;
}

export async function showPresetImport({ context, file, getPresets, commit }) {
    const data = parsePresetFile(await file.text());
    const current = getPresets();
    const baseline = JSON.stringify(current);
    const profiles = availableProfiles(context);
    const displayProfiles = [...profiles, ...data.connectionProfiles];
    const decisions = new Map();
    const mappings = new Map();
    const root = node('div', 'rc-tools-root rc-import-root');
    root.append(node('h3', 'rc-tools-title', 'Import presets'));
    root.append(node('p', 'rc-tools-description', `Review ${data.presets.length} preset${data.presets.length === 1 ? '' : 's'} from ${file.name}. Conflicts require a choice before import.`));
    const list = node('div', 'rc-import-preset-list');
    const preview = node('section', 'rc-import-preview');
    const connections = node('section', 'rc-import-connections');
    const summary = node('p', 'rc-import-summary');
    summary.setAttribute('aria-live', 'polite');
    const replacements = node('p', 'rc-import-replacements');
    const error = node('p', 'rc-tools-error');
    error.setAttribute('role', 'alert');
    let popup;
    let previewSide = 'incoming';
    const confirm = button('rc-import-confirm', 'Import', () => {
        try {
            const latest = getPresets();
            if (JSON.stringify(latest) !== baseline) throw new Error('Presets changed while reviewing. Cancel and reopen the file to review the latest versions.');
            const result = preparePresetImport(latest, data.presets, decisions, mappings, availableProfiles(context));
            if (!result.added && !result.replaced) return;
            confirm.disabled = true;
            commit(result.presets);
            popup.complete(1);
            toastr.success(`Imported ${result.added + result.replaced} preset${result.added + result.replaced === 1 ? '' : 's'} (${result.replaced} replaced).`);
        } catch (problem) { error.textContent = problem.message; updateSummary(); }
    });
    function showPreview(preset) {
        preview.replaceChildren(node('h4', 'rc-import-preview-title', `Preview: ${preset.name}`));
        const tabs = node('div', 'rc-import-preview-tabs');
        // Core assigns role=button to native buttons; use pressed toggle buttons.
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Preset preview');
        const columns = node('div', 'rc-import-preview-columns');
        const existing = current.find(p => p.name === preset.name);
        const panels = [previewPreset(existing, 'existing', profiles), previewPreset(preset, 'incoming', displayProfiles)];
        const tabButtons = [];
        function selectSide() {
            panels.forEach(panel => { panel.dataset.previewActive = String(panel.dataset.side === previewSide); });
            tabButtons.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.side === previewSide)));
        }
        for (const side of ['existing', 'incoming']) {
            const tab = button(`rc-import-preview-tab rc-import-preview-tab-${side}`, side === 'existing' ? 'Existing' : 'Incoming', () => {
                previewSide = side;
                selectSide();
            });
            tab.dataset.side = side;
            tab.setAttribute('aria-controls', `rc-import-${side}-preview`);
            tabs.append(tab);
            tabButtons.push(tab);
        }
        columns.append(...panels);
        preview.append(tabs, columns);
        selectSide();
    }
    function updateConnections() {
        const accepted = data.presets.filter(preset => ['add', 'replace', 'both'].includes(decisions.get(preset.name)));
        const missing = missingConnections(accepted, profiles);
        connections.replaceChildren();
        connections.hidden = !missing.length;
        if (missing.length) {
            connections.append(node('h4', 'rc-import-connections-title', 'Missing connections'));
            connections.append(node('small', 'rc-import-connections-description', 'Choose a local profile or Same as Current for each missing connection. These choices apply to all affected passes.'));
        }
        for (const id of missing) {
            const row = node('label', 'rc-import-connection-row');
            const name = data.connectionProfiles.find(p => p.id === id)?.name || id;
            const select = node('select', 'text_pole rc-import-connection-select');
            select.setAttribute('aria-label', `Connection for ${name}`);
            option(select, 'Choose a connection…', '');
            select.options[0].disabled = true;
            option(select, 'Same as Current', '');
            profiles.forEach(profile => option(select, profile.name, profile.id));
            select.selectedIndex = mappings.has(id)
                ? [...select.options].findIndex((entry, index) => index > 0 && entry.value === mappings.get(id)) : 0;
            select.addEventListener('change', () => { mappings.set(id, select.value); updateSummary(); });
            row.append(node('span', 'rc-import-connection-name', name), select);
            connections.append(row);
        }
    }
    function updateSummary() {
        const unresolved = data.presets.filter(p => !decisions.get(p.name)).length;
        const replacedNames = data.presets.filter(p => decisions.get(p.name) === 'replace').map(p => p.name);
        replacements.textContent = replacedNames.length ? `Import will replace: ${replacedNames.join(', ')}.` : '';
        confirm.textContent = replacedNames.length ? `Import (replace ${replacedNames.length})` : 'Import';
        if (unresolved) {
            confirm.disabled = true;
            summary.textContent = `Choose an action for ${unresolved} conflicting preset${unresolved === 1 ? '' : 's'}.`;
            return;
        }
        try {
            const result = preparePresetImport(current, data.presets, decisions, mappings, profiles);
            summary.textContent = `Add ${result.added} · Replace ${result.replaced} · Skip ${result.skipped}`;
            confirm.disabled = !result.added && !result.replaced;
        } catch (problem) { confirm.disabled = true; summary.textContent = problem.message; }
    }
    for (const preset of data.presets) {
        const conflict = current.some(p => p.name === preset.name);
        decisions.set(preset.name, conflict ? '' : 'add');
        const row = node('div', 'rc-import-preset-row');
        const name = node('span', 'rc-import-preset-name', preset.name);
        const action = node('select', 'text_pole rc-import-action');
        action.setAttribute('aria-label', `Import action for ${preset.name}`);
        if (conflict) {
            option(action, 'Choose…', '');
            action.options[0].disabled = true;
            option(action, 'Keep existing', 'skip');
            option(action, 'Replace', 'replace');
            option(action, 'Keep both', 'both');
            name.append(node('small', 'rc-import-conflict-tag', 'Name conflict'));
        } else { option(action, 'Import', 'add'); option(action, 'Skip', 'skip'); }
        action.value = decisions.get(preset.name);
        action.addEventListener('change', () => {
            decisions.set(preset.name, action.value);
            error.textContent = '';
            updateConnections();
            updateSummary();
        });
        row.append(name, action, button('rc-import-preview-button', 'Preview', () => showPreview(preset)));
        list.append(row);
    }
    const footer = node('div', 'rc-tools-footer');
    footer.append(button('rc-tools-cancel', 'Cancel', () => popup.complete(null)), confirm);
    root.append(list, preview, connections, summary, replacements, error, footer);
    const first = data.presets.find(p => current.some(existing => existing.name === p.name));
    if (first) showPreview(first);
    updateConnections();
    updateSummary();
    popup = dialog(context, root, 'rc-import-dialog', document.activeElement);
    await popup.show();
}
