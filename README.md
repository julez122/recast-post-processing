# Recast | SillyTavern Prose Post-Processing

This is my personal fork of [closuretxt's Recast extension](https://github.com/closuretxt/recast-post-processing) with various new features and fixes.

## Fork Changelog

- Various CSS fixes to prevent clipped modals, buttons and other input fields.
- Version 1.87 adds pass Move/Copy, preset import/export with conflict previews and connection mapping, fitted wrapping pass names, a mobile editor header, and modal fixes.
- Version 1.88 adds various CSS and UI improvements to the post-processing pipeline, including enhanced modal handling and better mobile support. The diff viewer textarea now is seperate from the final diff viewer using it's own separate section to improve readability on narrow screens.

## 🚀 Installation

1. Open SillyTavern, go to the Extensions menu (boxes icon).
2. Click "Install Extension" at the top right.
3. Paste this URL and click 'Install for me':

```plaintext
https://github.com/julez122/recast-post-processing
```

## About ST Post-Processing

**Recast** or **ST Post-Processing** is a SillyTavern extension that adds a highly configurable, multi-pass post-processing pipeline to any AI message output. Aiming towards improving the quality and coherence of the final message.

In the near future, LLMs will be accompanied by output post-processing, allowing models to be corrected, realigned or to fulfill specific purposes without being overly instrusive.
The main problem with LLMs cannot go back once their final response was generated or predict what they will say next, reasoning can help but it's still prone to context poisoning, semantic bleed, lack of creativity or lack of coherence.
Post-processing solves that by allowing completely separate system prompts, reasoning chains or smaller models to take over the original response to verify accuracy or improve the quality of the text without being _completely_ contextually aware of what the original request was.

**The Problem With Prompt Engineering:** If you create and edit prompts often, you probably noticed that there is a ceiling you hit very fast, with LLMs lacking the abilities to keep up with so many things at once, while _also_ sounding natural and creative. _But what if you could make them all work reliably?_ The concept of Post-Processing comes in; By breaking down into tasks _after_ the original message was generated, you keep creativity and add restraints after, allowing models to freely create content that will be modified during post-processing steps with strict prompt control.
_Make use of what LLMs are the best at: Smaller, clear and direct tasks._

⚠️ _This system makes use of multiple API calls, proceed at your own responsability and beware of usage costs._ ⚠️

## 🌟 Core Concept

After a message is generated, you can run it through a sequence of independent transformation passes. Each pass takes the previous output, applies a custom prompt via a separate model/API call, and returns the transformed text.

**Passes are completely independent:**

- They don't use your main prompt.
- They don't share context.
- They don't know about each other.
- They work even with reasoning or not and making use of entirely different models and connection profiles.

Essentially, this picks up a response, processes it through each pass in your pipeline, and overwrites it with the final result. With a solid setup, models also start to automatically pickup high-quality prose from previous responses.

![Example Image](https://raw.githubusercontent.com/closuretxt/closure-imgdump/refs/heads/main/openrouter%20free%20model.png)

## ✨ Features

- **Force LLMs to comply with strict rules:** Make models respect character personalities, speech, complex prose styles, world rules & systems, banned words/behavior or anything else you may want them to!
- **Multi-Pass Pipeline:** Chain multiple prompts together. E.g., Pass 1: "Verify character behavior", Pass 2: "Enhance prose".
- **Customizeable Passes:** Make any prompt for any kind of work, including spicing up the text or adding HTML or XML tags.
- **Reliable Bans:** Ban words, phrases or character behaviors with context awareness and without lobotomizing your model's creativity.
- **Model Agnostic (Connection Profiles):** Use different models for different tasks! Use an emotionally aware model for character validation, and a reasoning model for prose refinement. _(Requires Connection Profiles)_
- **ST Features Integration:** Supports injection of Character Cards, World Info, WI Outlets, Macros, and Scene Context into your post-processing passes.
- **Diff Viewer:** Review, edit, accept, or reject the changes made by the pipeline with a clean side-by-side diff UI.
- **Highly Customizable:**
  - Auto-run on generation or trigger manually.
  - Skip diff view and hide original message for seamless use.
- **Preset System:** Save, load, and manage different pipeline configurations. Drag and drop passes to reorder them.
- **Move/Copy Passes:** The copy icon beneath the pass chevron opens a preset picker. Copy appends the complete pass to every selected preset; Move also removes it from the source. The source preset remains available even when empty.
- **Preset Import/Export:** Manage Presets has Import and Export footer buttons. Export downloads all presets in one JSON file. Import includes per-conflict decisions, full prompt/prefill previews, and explicit mapping for unavailable connection profiles.
- **Readable Pass Names:** Short names use fitted fields; longer names wrap and grow vertically without moving the icon controls. On narrow screens, Advanced Preset View puts the pass name below its title and close button.
- **Macro Support:** Allows the injection of macros inside the post-processing prompts, allowing other extensions & information to be used in specific passes. Recast also exposes `{{recast_latest}}` and `{{recast_<pass_id>}}` macros for advanced workflows.
- **Slash Commands:** Expand utility through support commands and ST-scripts, customizing pass usage and trigger conditions.
- **Simple Direct Design:** We kept everything compact and direct, with advanced options being optional.

## 💡 Usage Guide

1. Navigate to the **Recast Post-Processing** menu in your Extensions tab.
2. Ensure **Enable Pipeline** is checked.
3. (Optional) Click **Add Pass** to create your custom transformation step or use any of the default ones.
4. Configure the pass:
   - **Prompt:** Give or edit instructions to the model (e.g., "Rewrite the following text to be more descriptive...").
   - **Connection:** Select the model/API you want to use for this specific task.
   - **Context Options:** Expand the pass details to adjust Context Length, or use the 3-dot menu to inject World Info, Outlets, Character Cards, or Scene Context.
5. When the AI generates a response, Recast will process it (if "Auto-run" is on), or you can manually click **Run Pipeline**.

_The settings are per-pass and are available by clicking on the arrow:_
![Extension UI](https://raw.githubusercontent.com/closuretxt/closure-imgdump/refs/heads/main/pass%20settings2.png)

### Preset backups and transfers

Pass edits already save automatically through SillyTavern. Presets live in `extension_settings.Recast.presets` inside your user's `settings.json`, independently of the installed extension folder. The fork retains the same `Recast` namespace, so reinstalling it preserves your existing presets.

Open **Manage Presets → Export** to immediately download every preset, in its current order, with complete pass settings and literal prompts/macros. JSON format 1 identifies itself with `format: "recast-presets"` and `version: 1`; it contains a `presets` array and `connectionProfiles` display metadata (`id` and `name` only). Global Recast preferences, the active preset selection, connection definitions, API keys, and chat history are not part of this export.

Choose **Import** and select a Recast JSON export. Review the incoming presets before committing. New names default to Import; conflicting names require **Keep existing**, **Replace**, or **Keep both**. Keep both adds a uniquely suffixed copy. **Preview** shows the existing and incoming pass lists, complete prompt/prefill text, and configuration. Desktop shows both sides; narrow screens have Existing/Incoming tabs. The final summary lists any presets being replaced. Cancel or Escape discards the review.

If a referenced connection-profile ID is unavailable locally, explicitly select a local profile or **Same as Current** for it. One selection applies to every imported pass referencing that profile. Matching display names do not automatically map profiles. Connection credentials must be configured separately in SillyTavern.

The icon-only **Move/Copy to…** control opens a multi-preset picker. The source is labelled Current preset and cannot be selected. Transfers append after the destination's existing passes. IDs remain the same when available; a destination collision allocates a new ID and adjusts exact self-references in the copied prompt/prefill. Other pass references stay literal. Imported presets retain their valid pass IDs and macro references.

### Recommended Workflow

- **Chat Completion** - This extension requires at least one Chat Completion endpoint, but we recommend at least two.
- **Pass 1: Character Validation** - Use a fast, non-reasoning, emotionally-aware model to ensure the character isn't acting out of themselves.
- **Pass 2: Prose Refinement** - Use a strong reasoning model to enhance the vocabulary, fix grammar, and elevate the writing style.
- **Editing Main Prompt** - Remove or edit any bloat that may restrain the model's creativity, including banning words, strict high-quality writing styles, etc. Please save your original prompts beforehand.
- **Change as you go** - Modifying your main and pass prompts to fulfill your personal preferences is ideal.
- **Trying out** - Trying out with different main or pass models, both non-reasoning and reasoning ones is recommended. Speed and pricing is also something to be considered, since each pass is a different request!

## 🛠️ Prerequisites

- Tested and built on the **Latest Staging** build of SillyTavern.
- For model switching per pass, the **Connection Profiles** extension must be enabled.

### Troubleshooting

- If you have any API issues, turn on 'Legacy Connection Profile' in Advanced Settings and make sure the API is valid.
- If you are using CoT Extensions like Stepped Thinking, enable 'Compatibility Mode' in Advanced Settings.

## Examples

- Claude 4.6 Opus as the Main Model, GLM 5 No reasoning (Validator) and DS 3.2 Reasoning (Prose)
  ![Example Image](https://raw.githubusercontent.com/closuretxt/closure-imgdump/refs/heads/main/claude%20opus%204.6.png)
  ![Example Image](https://raw.githubusercontent.com/closuretxt/closure-imgdump/refs/heads/main/claude%20opus%204.6%202.png)

- Gemini 2 Lite as the Main Model, GLM 5 No reasoning (Validator) and DS 3.2 Reasoning (Prose)
  ![Example Image](https://github.com/closuretxt/closure-imgdump/blob/main/gemini%202%20lite.png)

- Deepseek 3.2 Reasoning, GLM 5 No reasoning (Validator) and DS 3.2 Reasoning (Prose)
  ![Example](https://raw.githubusercontent.com/closuretxt/closure-imgdump/refs/heads/main/deepseek%20reasoning.png)

## 🤝 Support and Contributions

Contact me through the Discord extension post or Reddit comments on the original post regarding this extension.
You can help by submitting bug reports or opening pull requests!

### Special Thanks

- _Qvink for the Qvink Memory Extension! [Available here](github.com/qvink/qvink_memory)_
- _Rivelle for the Beautiful custom theme - Moonlit Echoes! [Available here](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme)_
- _RossAscends for the robust Profile Switching! [Available here](https://github.com/RossAscends/ST-TCReasoningProfile)_
- _SillyTavern devs, [weather](https://github.com/bmen25124), [Qvink](github.com/qvink) and community for the ConnectionProfileService_

## 📄 License

AGPL-3.0 LICENSE || Copyright (C) 2026 closuretxt || Please read LICENSE for more information.

## UPDATES

- ~~Legacy API and Compatibility Mode with other extensions~~ (1.3+)
- ~~Step Diff Viewer (View how the text changed per pass)~~ (1.4+)
- ~~Mobile Support~~ (1.4+)

### TO-DO

- Expand Prompts View (AKA Advanced Setup Screen)
- Addition Type Pass (For Trackers, HTML injection, Image Gen, etc)
- Text Completion Support
- ~~Exporting and Importing Recast Presets~~ (This fork version 1.87)
- Character Locking Presets
- Advanced Prompt Control, prefills and role management Options, trigger cooldowns
- Conditional Pass Triggers based on ST-script (Can be done with QR right now)
- Adaptative Pass to decide the order and which Passes will be used for the upcoming generation
- Tool Calling
- Reroll button (Original > Goes again) / Pipeline Again (Pass result on the pipeline again) on the review menu
- Localization
- No scrolling when not at the bottom of the page
- Show diff view button and inside the diff view able to reverse it
- View model reasoning on diff page
- If no connection preset or invalid, use the current one.
- Dynamic Substitution
