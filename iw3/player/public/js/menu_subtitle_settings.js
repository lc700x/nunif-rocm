import { Container, Text, Image } from '@pmndrs/uikit';
import { COLORS, LIMITS, DEFAULTS, UI_CONFIG, SETTINGS_METADATA } from './constants.js';
import { UIUtils } from './ui_common.js';
import { storage } from './storage.js';
import * as THREE from 'three';

class SubtitleSettingsMenu {
    constructor(uiManager, defaultFont) {
        this.uiManager = uiManager;
        this.managedKeys = new Set([
            'subtitle_y', 'subtitle_z', 'subtitle_font_size', 'subtitle_eye_sep', 'subtitle_visible'
        ]);
        this.values = {
            subtitle_y: DEFAULTS.subtitle_y,
            subtitle_z: DEFAULTS.subtitle_z,
            subtitle_font_size: DEFAULTS.subtitle_font_size,
            subtitle_eye_sep: DEFAULTS.subtitle_eye_sep,
            subtitle_visible: DEFAULTS.subtitle_visible
        };

        this.container = new Container({
            flexDirection: 'column',
            backgroundColor: COLORS.bg,
            backgroundOpacity: 0.9,
            borderRadius: 24,
            padding: 24,
            gap: 16,
            width: 400,
            display: 'none',
            position: 'absolute',
            marginLeft: UI_CONFIG.menuMarginLeft,
            marginTop: UI_CONFIG.menuMarginTop,
            fontFamily: defaultFont,
            borderColor: COLORS.border,
            borderWidth: 2,
        });

        this.setupUI();
    }

    setupUI() {
        const u = this.uiManager;
        
        this.setupHeader();

        // Subtitle Selector
        this.setupTrackSelector();

        // Visibility Toggle (Checkbox)
        const toggleRow = new Container({
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginTop: 10,
            marginBottom: 10
        });
        toggleRow.add(new Text({ text: "Show Subtitles", fontSize: 18, color: COLORS.textDim }));
        this.toggleBtn = UIUtils.createButton('icons/square.svg', () => u.toggleSubtitles(), u, 22, 48);
        toggleRow.add(this.toggleBtn.container);
        this.container.add(toggleRow);

        // Sliders
        this.sliders = {
            subtitle_font_size: UIUtils.createSlider(this.container, "Font Size", "subtitle_font_size", LIMITS.subtitle_font_sizeMin, LIMITS.subtitle_font_sizeMax, u, () => u.onSliderChange('subtitle_font_size', DEFAULTS.subtitle_font_size)),
            subtitle_z: UIUtils.createSlider(this.container, "Distance", "subtitle_z", LIMITS.subtitle_zMin, LIMITS.subtitle_zMax, u, () => u.onSliderChange('subtitle_z', DEFAULTS.subtitle_z)),
            subtitle_y: UIUtils.createSlider(this.container, "Vertical Position", "subtitle_y", LIMITS.subtitle_yMin, LIMITS.subtitle_yMax, u, () => u.onSliderChange('subtitle_y', DEFAULTS.subtitle_y)),
            subtitle_eye_sep: UIUtils.createSlider(this.container, "Eye Separation", "subtitle_eye_sep", LIMITS.subtitle_eye_sepMin, LIMITS.subtitle_eye_sepMax, u, () => u.onSliderChange('subtitle_eye_sep', DEFAULTS.subtitle_eye_sep))
        };
    }

    setupTrackSelector() {
        const group = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 6,
            marginTop: 4
        });
        this.container.add(group);
        group.add(new Text({ text: "Track", fontSize: 16, color: COLORS.textDim }));

        const selector = new Container({
            flexDirection: 'row',
            width: '100%',
            height: 48,
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: COLORS.button,
            borderRadius: 8,
            padding: 4,
        });
        group.add(selector);

        const createArrowBtn = (icon, delta) => {
            return new Container({
                width: 40,
                height: 40,
                borderRadius: 6,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                hover: { backgroundColor: COLORS.hover },
                onPointerEnter: (e) => UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, this.uiManager),
                onClick: (e) => {
                    UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, this.uiManager);
                    this.uiManager.changeSubtitle(delta);
                }
            }).add(new Image({ src: icon, width: 32, height: 32, color: COLORS.text }));
        };

        selector.add(createArrowBtn('icons/chevron-left.svg', -1));
        this.trackNameText = new Text({
            text: "None",
            fontSize: 14,
            color: COLORS.text,
            width: 250,
            textAlign: 'center',
            wordBreak: 'break-all'
        });
        selector.add(this.trackNameText);
        selector.add(createArrowBtn('icons/chevron-right.svg', 1));
    }

    handlesKey(id) {
        return this.managedKeys.has(id);
    }

    async onValueChange(id, val, shouldSave) {
        switch (id) {
            case 'subtitle_visible':
                this.uiManager.showSubtitles = val;
                this.uiManager.stereoPlayer.updateSubtitlesMode(val);
                break;
            case 'subtitle_y':
                this.uiManager.subY = val;
                break;
            case 'subtitle_z':
                this.uiManager.subZ = val;
                break;
            case 'subtitle_font_size':
                this.uiManager.subFontSize = val;
                break;
            case 'subtitle_eye_sep':
                this.uiManager.subEyeSep = val;
                break;
        }

        this.values[id] = val;
        if (shouldSave) {
            await this.save();
        }
    }

    async load() {
        const saved = storage.get('subtitle');
        if (saved) {
            Object.assign(this.values, saved);
        }
        for (let id in this.values) {
            await this.uiManager.onSliderChange(id, this.values[id], false);
        }
    }

    async save() {
        await storage.set('subtitle', this.values);
    }

    async reset() {
        // 1. Delete file-specific settings for the 'subtitle' group
        const currentItem = this.uiManager.stereoPlayer.galleryManager.getCurrentItem();
        if (currentItem) {
            this.uiManager.debugLogInstance.log(`[Config] Resetting subtitle settings group`);
            const updates = {};
            Object.entries(SETTINGS_METADATA).forEach(([key, meta]) => {
                if (meta.group === 'subtitle') {
                    updates[key] = undefined; // Request removal
                }
            });
            await storage.updateFileConfig(currentItem, updates);
            this.uiManager.dirtyGroups.delete('subtitle');
        }

        // 2. Apply default values to UI (without saving back to file config)
        const defaults = {
            subtitle_y: DEFAULTS.subtitle_y,
            subtitle_z: DEFAULTS.subtitle_z,
            subtitle_font_size: DEFAULTS.subtitle_font_size,
            subtitle_eye_sep: DEFAULTS.subtitle_eye_sep,
            subtitle_visible: DEFAULTS.subtitle_visible
        };
        for (const [id, val] of Object.entries(defaults)) {
            await this.uiManager.onSliderChange(id, val, false);
        }
        
        // Reset track selection
        const hasTracks = this.uiManager.availableSubtitles.length > 0;
        this.uiManager.currentSubtitleIndex = hasTracks ? 0 : -1;
        this.uiManager.stereoPlayer.setSubtitleTrack(this.uiManager.currentSubtitleIndex);

        this.uiManager.syncUI(true);
    }

    sync(metadata) {
        const trackWidth = 332;
        const thumbWidth = 24;
        const data = this.values;

        // Helper to calculate percentage based on current limits
        const getPercent = (val, min, max) => THREE.MathUtils.clamp((val - min) / (max - min), 0, 1);

        // Update sliders with guards
        const sliders = [
            { sl: this.sliders.subtitle_font_size, val: data.subtitle_font_size, min: LIMITS.subtitle_font_sizeMin, max: LIMITS.subtitle_font_sizeMax },
            { sl: this.sliders.subtitle_z, val: data.subtitle_z, min: LIMITS.subtitle_zMin, max: LIMITS.subtitle_zMax },
            { sl: this.sliders.subtitle_y, val: data.subtitle_y, min: LIMITS.subtitle_yMin, max: LIMITS.subtitle_yMax },
            { sl: this.sliders.subtitle_eye_sep, val: data.subtitle_eye_sep, min: LIMITS.subtitle_eye_sepMin, max: LIMITS.subtitle_eye_sepMax }
        ];

        sliders.forEach(s => {
            const margin = getPercent(s.val, s.min, s.max) * (trackWidth - thumbWidth);
            if (Math.abs((s.sl._lastMargin || 0) - margin) > 0.1) {
                s.sl.thumb.setProperties({ marginLeft: margin });
                s.sl._lastMargin = margin;
            }
        });

        // Update Toggle button (Checkbox) with guard
        const show = data.subtitle_visible;
        if (this._lastShow !== show) {
            this.toggleBtn.image.setProperties({ 
                src: show ? 'icons/square-check.svg' : 'icons/square.svg',
                color: show ? COLORS.text : COLORS.hover
            });
            this.toggleBtn.setSelected(show);
            this._lastShow = show;
        }

        // Update track name with guard
        if (this.trackNameText) {
            const trackText = metadata?.currentSubtitleTitle || "None";
            if (this._lastTrackText !== trackText) {
                this.trackNameText.setProperties({ text: trackText });
                this._lastTrackText = trackText;
            }
        }
        this._lastAlignIcon = UIUtils.updateAlignIcon(this.headerBtns?.alignBtn, this.uiManager, this._lastAlignIcon);
    }

    setupHeader() {
        this.headerBtns = UIUtils.setupWindowHeader(this.container, "Subtitle Settings", () => this.reset(), this.uiManager);
    }
}

export { SubtitleSettingsMenu };
