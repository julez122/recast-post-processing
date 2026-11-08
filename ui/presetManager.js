// Preset persistence, manager UI and integration with native transfer/import dialogs.

import { extension_settings, getContext } from "../../../../extensions.js";
import { saveSettingsDebounced } from "../../../../../script.js";
import { defaultPresets } from "../settings/defaultPresets.js";
import { clonePresetData, createPresetExport } from '../settings/presetTools.js';
import { availableProfiles, showPassTransfer, showPresetImport } from './presetDialogs.js';

export const extensionName = "Recast";

// Provide dependencies from index.js
let addPassToUIFn = null;
let refreshMacrosFn = null;
let closeEditorFn = null;

export const presetManager = {
    init: function(addPassFn, _saveFn, refreshFn = null, closeFn = null) {
        addPassToUIFn = addPassFn;
        refreshMacrosFn = typeof refreshFn === "function" ? refreshFn : null;
        closeEditorFn = closeFn;

        // Save Button (Overrides current preset silently)
        $("#recast_save_preset").off("click").on("click", () => {
            this.saveActivePreset();
            toastr.success(`Preset "${extension_settings[extensionName].active_preset}" saved.`, '', { escapeHtml: true });
        });

        // Load Button (Opens Manager Modal)
        $("#recast_load_preset").off("click").on("click", () => {
            this.openManagerModal();
        });

        // Dropdown selection
        $("#recast_preset_select").off("change").on("change", (e) => {
            extension_settings[extensionName].active_preset = $(e.target).val();
            this.loadActivePreset();
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
        });

        // Setup modal events
        this.initModalEvents();
    },

    getActivePresetIndex: function() {
        if (!extension_settings[extensionName]?.presets) return -1;
        return extension_settings[extensionName].presets.findIndex(p => p.name === extension_settings[extensionName].active_preset);
    },

    readActivePasses: function() {
        const idx = this.getActivePresetIndex();
        if (idx === -1) return [];
        const stored = extension_settings[extensionName].presets[idx].passes;
        const passes = [];
        // The pass editor popup temporarily parks one pass's fields inside the modal —
        // extend the search scope to the modal for that pass so saving still sees them
        const editorModal = $("#recast_pass_editor_modal");
        const editorPassId = editorModal.data("host-pass-id");
        $("#recast_pass_list .recast-pass-item").each(function() {
            const item = $(this);
            const scope = editorPassId && item.data("id") === editorPassId ? item.add(editorModal) : item;
            const original = clonePresetData(stored.find(pass => pass.id === item.data('id')) || item.data('pass-data') || {});
            const readText = (selector, field) => {
                const value = scope.find(selector).val() || '';
                // Textareas normalize line endings. Preserve the stored text when unedited.
                return typeof original[field] === 'string' && original[field].replace(/\r\n?/g, '\n') === value
                    ? original[field] : value;
            };
            passes.push({
                ...original,
                id: item.data("id"),
                name: scope.find(".pass-name").val(),
                enabled: scope.find(".pass-enabled").prop("checked"),
                contextLength: Math.max(0, parseInt(scope.find(".pass-context-length").val(), 10) || 0),
                prompt: readText('.pass-prompt', 'prompt'),
                prefill: readText('.pass-prefill', 'prefill'),
                prefillRole: scope.find(".pass-prefill-role").val() || "assistant",
                connection: scope.find(".pass-connection").val() || '',
                injectWorldInfo: scope.find(".pass-inject-world-info").prop("checked"),
                injectWIOutlets: scope.find(".pass-inject-wi-outlets").prop("checked"),
                includeCharCard: scope.find(".pass-include-char-card").prop("checked"),
                includeSceneContext: scope.find(".pass-include-scene-context").prop("checked")
            });
        });
        return passes;
    },

    snapshotPresets: function() {
        const presets = clonePresetData(extension_settings[extensionName].presets);
        const idx = this.getActivePresetIndex();
        if (idx >= 0 && $('#recast_pass_list').data('preset-name') === extension_settings[extensionName].active_preset) {
            presets[idx].passes = this.readActivePasses();
        }
        return presets;
    },

    saveActivePreset: function() {
        const idx = this.getActivePresetIndex();
        if (idx === -1 || $('#recast_pass_list').data('preset-name') !== extension_settings[extensionName].active_preset) return;
        const passes = this.readActivePasses();
        extension_settings[extensionName].presets[idx].passes = passes;
        if (refreshMacrosFn) refreshMacrosFn();
        saveSettingsDebounced();
    },

    populatePresetDropdown: function() {
        const select = $("#recast_preset_select");
        select.empty();
        if (extension_settings[extensionName]?.presets) {
            extension_settings[extensionName].presets.forEach(p => {
                select.append($("<option></option>").val(p.name).text(p.name));
            });
        }
        select.val(extension_settings[extensionName].active_preset);
    },

    loadActivePreset: function() {
        const idx = this.getActivePresetIndex();
        const preset = extension_settings[extensionName].presets[idx];
        const list = $("#recast_pass_list");

        // Close the pass editor first so its parked fields return before the list is rebuilt
        // The selected preset may already have changed. Never save parked old fields into it.
        if (closeEditorFn) closeEditorFn(false);

        list.empty();
        list.data('preset-name', preset?.name || '');
        
        if (preset && preset.passes && addPassToUIFn) {
            preset.passes.forEach(pass => {
                addPassToUIFn(pass);
            });
        }
        if (refreshMacrosFn) refreshMacrosFn();
    },

    // --- Modal Management ---

    initModalEvents: function() {
        $('#recast_pm_list').off('click.recastPresets');
        // Modal buttons
        $('#recast_preset_manager_close').off('click.recastPresets').on('click.recastPresets', () => this.closeManagerModal());
        $('#recast_pm_export').off('click.recastPresets').on('click.recastPresets', () => this.exportPresets());
        $('#recast_pm_import').off('click.recastPresets').on('click.recastPresets', () => $('#recast_pm_import_file').trigger('click'));
        $('#recast_pm_import_file').off('change.recastPresets').on('change.recastPresets', async event => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (!file) return;
            $('#recast_pm_import').prop('disabled', true);
            try {
                await showPresetImport({ context: getContext(), file,
                    getPresets: () => this.snapshotPresets(), commit: presets => this.commitPresets(presets) });
            } catch (error) { toastr.error(error.message, 'Preset import', { escapeHtml: true }); }
            finally { input.value = ''; $('#recast_pm_import').prop('disabled', false); }
        });

        $('#recast_pm_add').off('click.recastPresets').on('click.recastPresets', async () => {
            const st = getContext();
            const name = await st.Popup.show.input("Enter name for the new preset:", "");
            if (!name) return;

            if (extension_settings[extensionName].presets.find(p => p.name === name)) {
                toastr.warning("Preset already exists!");
                return;
            }

            extension_settings[extensionName].presets.push({ name: name, passes: [] });
            extension_settings[extensionName].active_preset = name;
            this.populatePresetDropdown();
            this.loadActivePreset();
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
        });

        $('#recast_pm_restore').off('click.recastPresets').on('click.recastPresets', async () => {
            const st = getContext();
            const confirm = await st.Popup.show.confirm("Restore Default Presets", "If a existing preset is named 'Default Preset' it will be overwritten. Proceed?");
            if (!confirm) return;

            defaultPresets.forEach(dp => {
                const existingIdx = extension_settings[extensionName].presets.findIndex(p => p.name === dp.name);
                if (existingIdx !== -1) {
                    extension_settings[extensionName].presets[existingIdx] = JSON.parse(JSON.stringify(dp));
                } else {
                    extension_settings[extensionName].presets.push(JSON.parse(JSON.stringify(dp)));
                }
            });
            this.populatePresetDropdown();
            this.loadActivePreset();
            
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
            toastr.success("Default presets restored.");
        });

        // Setup sortable list for rearrange
        $("#recast_pm_list").sortable({
            handle: ".rc-pm-drag",
            update: () => {
                this.saveManagerOrder();
            }
        });

        // Delegate events for list items (rename/delete)
        $('#recast_pm_list').on('click.recastPresets', '.rc-pm-delete', async (e) => {
            const name = $(e.currentTarget).closest(".rc-pm-item").data("name");
            const st = getContext();
            const description = document.createElement('p');
            description.className = 'rc-pm-delete-description';
            description.textContent = `Are you sure you want to delete "${name}"?`;
            const confirm = await st.callGenericPopup(description, st.POPUP_TYPE.CONFIRM);
            if (!confirm) return;

            extension_settings[extensionName].presets = extension_settings[extensionName].presets.filter(p => p.name !== name);
            if (extension_settings[extensionName].active_preset === name) {
                extension_settings[extensionName].active_preset = extension_settings[extensionName].presets[0]?.name || "";
            }
            this.populatePresetDropdown();
            this.loadActivePreset();
            if (refreshMacrosFn) refreshMacrosFn();
            saveSettingsDebounced();
            this.renderManagerList();
        });

        $('#recast_pm_list').on('click.recastPresets', '.rc-pm-rename', async (e) => {
            const item = $(e.currentTarget).closest(".rc-pm-item");
            const oldName = item.data("name");
            const st = getContext();
            const newName = await st.Popup.show.input('Rename preset:', '', oldName);
            
            if (!newName || newName === oldName) return;
            if (extension_settings[extensionName].presets.find(p => p.name === newName)) {
                toastr.warning("A preset with this name already exists.");
                return;
            }

            const preset = extension_settings[extensionName].presets.find(p => p.name === oldName);
            if (preset) {
                preset.name = newName;
                if (extension_settings[extensionName].active_preset === oldName) {
                    extension_settings[extensionName].active_preset = newName;
                }
                this.populatePresetDropdown();
                this.loadActivePreset();
                if (refreshMacrosFn) refreshMacrosFn();
                saveSettingsDebounced();
                this.renderManagerList();
            }
        });
    },

    openManagerModal: function() {
        this.renderManagerList();
        $("#recast_diff_backdrop").show(); // Reusing the backdrop
        $("#recast_preset_manager_modal").css("display", "flex");
    },

    closeManagerModal: function() {
        $('#recast_preset_manager_modal, #recast_diff_backdrop').hide();
        document.getElementById('recast_load_preset')?.focus({ preventScroll: true });
    },

    commitPresets: function(presets) {
        if (closeEditorFn) closeEditorFn(false);
        extension_settings[extensionName].presets = presets;
        if (!presets.some(p => p.name === extension_settings[extensionName].active_preset)) {
            extension_settings[extensionName].active_preset = presets[0]?.name || '';
        }
        this.populatePresetDropdown();
        this.loadActivePreset();
        if ($('#recast_preset_manager_modal').is(':visible')) this.renderManagerList();
        saveSettingsDebounced();
    },

    openPassTransfer: async function(passId) {
        try {
            await showPassTransfer({ context: getContext(), sourceName: extension_settings[extensionName].active_preset,
                passId, getPresets: () => this.snapshotPresets(), commit: presets => this.commitPresets(presets) });
        } catch (error) { toastr.error(error.message, 'Move/Copy pass', { escapeHtml: true }); }
    },

    exportPresets: function() {
        try {
            const data = createPresetExport(this.snapshotPresets(), availableProfiles(getContext()));
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.className = 'rc-preset-download';
            link.href = url;
            link.download = `recast-presets-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            link.hidden = true;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { toastr.error(error.message, 'Preset export', { escapeHtml: true }); }
    },

    renderManagerList: function() {
        const list = $("#recast_pm_list");
        list.empty();
        
        extension_settings[extensionName].presets.forEach(p => {
            const isActive = p.name === extension_settings[extensionName].active_preset;
            const itemHtml = `
                <div class="rc-pm-item">
                    <div class="rc-pm-drag fa-solid fa-grip-vertical"></div>
                    <div class="rc-pm-name"></div>
                    <div class="rc-pm-actions">
                        <button class="menu_button rc-pm-rename fa-solid fa-pen" title="Rename"></button>
                        <button class="menu_button red_button rc-pm-delete fa-solid fa-trash" title="Delete"></button>
                    </div>
                </div>
            `;
            const item = $(itemHtml).data('name', p.name);
            item.find('.rc-pm-name').text(p.name);
            if (isActive) item.find('.rc-pm-name').append($('<span class="rc-pm-active-tag"></span>').text('Active'));
            list.append(item);
        });
    },

    saveManagerOrder: function() {
        const newOrder = [];
        $("#recast_pm_list .rc-pm-item").each(function() {
            const name = $(this).data("name");
            const preset = extension_settings[extensionName].presets.find(p => p.name === name);
            if (preset) newOrder.push(preset);
        });
        extension_settings[extensionName].presets = newOrder;
        saveSettingsDebounced();
    }
};
