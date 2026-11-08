// Pure preset operations: prepare a complete result before the UI commits it.
export const PRESET_FILE_FORMAT = 'recast-presets';
export const PRESET_FILE_VERSION = 1;

export function clonePresetData(value) {
    return JSON.parse(JSON.stringify(value));
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const passDefaults = {
    enabled: true, contextLength: 3, prompt: '', prefill: '', prefillRole: 'assistant',
    connection: '', injectWorldInfo: false, injectWIOutlets: false,
    includeCharCard: true, includeSceneContext: true,
};

function validatePresets(presets) {
    if (!Array.isArray(presets)) throw new Error('The file must contain a presets array.');
    const names = new Set();
    return presets.map((preset, index) => {
        if (!isRecord(preset) || typeof preset.name !== 'string' || !preset.name.trim() || !Array.isArray(preset.passes)) {
            throw new Error(`Preset ${index + 1} needs a name and a passes array.`);
        }
        if (names.has(preset.name)) throw new Error(`Duplicate preset name in file: ${preset.name}`);
        names.add(preset.name);
        const ids = new Set();
        const copy = clonePresetData(preset);
        copy.passes = copy.passes.map((pass, passIndex) => {
            const location = `Pass ${passIndex + 1} in "${preset.name}"`;
            if (!isRecord(pass) || typeof pass.id !== 'string' || !pass.id.trim() || typeof pass.name !== 'string') {
                throw new Error(`${location} needs a string ID and name.`);
            }
            if (ids.has(pass.id)) throw new Error(`${location} has a duplicate pass ID.`);
            ids.add(pass.id);
            for (const [key, value] of Object.entries(passDefaults)) {
                if (!has(pass, key)) pass[key] = value;
                if (typeof pass[key] !== typeof value) throw new Error(`${location}: invalid ${key}.`);
            }
            if (!Number.isSafeInteger(pass.contextLength) || pass.contextLength < 0) {
                throw new Error(`${location}: context length must be a nonnegative integer.`);
            }
            if (!['assistant', 'user', 'system'].includes(pass.prefillRole)) {
                throw new Error(`${location}: invalid prefill role.`);
            }
            return pass;
        });
        return copy;
    });
}

export function parsePresetFile(text) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, '')); }
    catch { throw new Error('This file is not valid JSON.'); }
    if (!isRecord(data) || data.format !== PRESET_FILE_FORMAT) throw new Error('This is not a Recast preset export.');
    if (data.version !== PRESET_FILE_VERSION) throw new Error(`Unsupported Recast preset file version: ${data.version}`);
    const profiles = data.connectionProfiles ?? [];
    if (!Array.isArray(profiles) || profiles.some(p => !isRecord(p) || typeof p.id !== 'string' || typeof p.name !== 'string')) {
        throw new Error('Invalid connection-profile display metadata.');
    }
    return {
        presets: validatePresets(data.presets),
        connectionProfiles: profiles.map(({ id, name }) => ({ id, name })),
    };
}

export function createPresetExport(presets, profiles = []) {
    const referenced = new Set(presets.flatMap(p => p.passes.map(pass => pass.connection)).filter(Boolean));
    return {
        format: PRESET_FILE_FORMAT, version: PRESET_FILE_VERSION,
        presets: clonePresetData(presets),
        // Only IDs and display names leave SillyTavern, never profile settings or secrets.
        connectionProfiles: [...referenced].map(id => ({ id, name: profiles.find(p => p.id === id)?.name || id })),
    };
}

export function newPassId() {
    return `pass_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

export function preparePassTransfer(presets, sourceName, passId, destinationNames, move = false, makeId = newPassId) {
    const source = presets.find(p => p.name === sourceName);
    const pass = source?.passes.find(p => p.id === passId);
    const destinations = [...new Set(destinationNames)];
    if (!source || !pass) throw new Error('The source preset or pass no longer exists.');
    if (!destinations.length) throw new Error('Select at least one destination preset.');
    if (destinations.some(name => name === sourceName || !presets.some(p => p.name === name))) {
        throw new Error('A destination is no longer available. Please reopen Move/Copy to….');
    }
    const result = clonePresetData(presets);
    for (const name of destinations) {
        const target = result.find(p => p.name === name);
        const copied = clonePresetData(pass);
        if (target.passes.some(p => p.id === copied.id)) {
            const oldId = copied.id;
            let attempts = 0;
            do {
                if (++attempts > 100) throw new Error('Could not allocate a unique pass ID.');
                copied.id = makeId();
            } while (target.passes.some(p => p.id === copied.id));
            for (const field of ['prompt', 'prefill']) {
                if (typeof copied[field] === 'string') {
                    copied[field] = copied[field].split(`{{recast_${oldId}}}`).join(`{{recast_${copied.id}}}`);
                }
            }
        }
        target.passes.push(copied);
    }
    if (move) result.find(p => p.name === sourceName).passes = source.passes.filter(p => p.id !== passId).map(clonePresetData);
    return result;
}

export function missingConnections(presets, profiles) {
    const available = new Set(profiles.map(p => p.id));
    return [...new Set(presets.flatMap(p => p.passes.map(pass => pass.connection)).filter(id => id && !available.has(id)))];
}

export function preparePresetImport(current, incoming, decisions, mappings, profiles) {
    const available = new Set(profiles.map(p => p.id));
    const result = clonePresetData(current);
    const changes = { added: 0, replaced: 0, skipped: 0 };
    // Reserve all incoming original names before choosing suffixes for Keep both.
    const reserved = new Set([...current, ...incoming].map(p => p.name));
    for (const preset of incoming) {
        const action = decisions.get(preset.name);
        const existing = result.findIndex(p => p.name === preset.name);
        if (action === 'skip') { changes.skipped++; continue; }
        if (existing >= 0 ? !['replace', 'both'].includes(action) : action !== 'add') {
            throw new Error(`Choose how to import "${preset.name}".`);
        }
        const copied = clonePresetData(preset);
        if (action === 'both') {
            let suffix = 2;
            do { copied.name = `${preset.name} (imported ${suffix++})`; } while (reserved.has(copied.name));
            reserved.add(copied.name);
        }
        for (const pass of copied.passes) {
            if (pass.connection && !available.has(pass.connection)) {
                if (!mappings.has(pass.connection)) throw new Error('Choose a local connection for each missing profile.');
                const replacement = mappings.get(pass.connection);
                if (replacement !== '' && !available.has(replacement)) throw new Error('A selected local connection is no longer available.');
                pass.connection = replacement;
            }
        }
        if (action === 'replace') { result[existing] = copied; changes.replaced++; }
        else { result.push(copied); changes.added++; }
    }
    return { presets: result, ...changes };
}
