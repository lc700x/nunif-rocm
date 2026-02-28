import { Container, Text, Image } from '@pmndrs/uikit';
import { COLORS, LIMITS, DEFAULTS, UI_CONFIG } from './constants.js';
import { UIUtils } from './ui_common.js';
import { storage } from './storage.js';
import * as THREE from 'three';

class ColorSettingsMenu {
    constructor(uiManager, defaultFont) {
        this.uiManager = uiManager;
        this.managedKeys = new Set([
            'color_contrast', 'color_brightness', 'color_hue',
            'color_saturation', 'color_gamma', 'color_lut'
        ]);
        this.values = {
            color_contrast: DEFAULTS.color_contrast,
            color_brightness: DEFAULTS.color_brightness,
            color_hue: DEFAULTS.color_hue,
            color_saturation: DEFAULTS.color_saturation,
            color_gamma: DEFAULTS.color_gamma,
            color_lut: DEFAULTS.color_lut || "None"
        };

        this.container = new Container({
            flexDirection: 'column',
            backgroundColor: COLORS.bg,
            backgroundOpacity: 0.9,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: COLORS.border,
            padding: 24,
            gap: 0,
            width: 400,
            display: 'none',
            position: 'absolute',
            marginLeft: UI_CONFIG.menuMarginLeft,
            marginTop: UI_CONFIG.menuMarginTop,
            fontFamily: defaultFont
        });

        this.setupHeader();
        this.setupSelectors();

        this.sliders = {};
        const config = [
            ["Contrast", "color_contrast", LIMITS.color_contrastMin, LIMITS.color_contrastMax, DEFAULTS.color_contrast],
            ["Brightness", "color_brightness", LIMITS.color_brightnessMin, LIMITS.color_brightnessMax, DEFAULTS.color_brightness],
            ["Hue", "color_hue", LIMITS.color_hueMin, LIMITS.color_hueMax, DEFAULTS.color_hue],
            ["Saturation", "color_saturation", LIMITS.color_saturationMin, LIMITS.color_saturationMax, DEFAULTS.color_saturation],
            ["Gamma", "color_gamma", LIMITS.color_gammaMin, LIMITS.color_gammaMax, DEFAULTS.color_gamma]
        ];

        config.forEach(([label, id, min, max, defVal]) => {
            this.sliders[id] = UIUtils.createSlider(
                this.container, 
                label, 
                id, 
                min, 
                max, 
                this.uiManager,
                () => this.uiManager.onSliderChange(id, defVal)
            );
        });
    }

    setupHeader() {
        this.headerBtns = UIUtils.setupWindowHeader(this.container, "Color Settings", () => this.reset(), this.uiManager);
    }

    reset() {
        const defaults = {
            color_brightness: DEFAULTS.color_brightness,
            color_contrast: DEFAULTS.color_contrast,
            color_gamma: DEFAULTS.color_gamma,
            color_saturation: DEFAULTS.color_saturation,
            color_hue: DEFAULTS.color_hue
        };
        Object.entries(defaults).forEach(([id, val]) => this.uiManager.onSliderChange(id, val));
        this.uiManager.resetLut();
    }

    setupSelectors() {
        const group = new Container({ flexDirection: 'column', gap: 4, marginTop: 12, marginBottom: 12 });
        group.add(new Text({ text: "LUT (Color Profile)", fontSize: 16, color: COLORS.textDim }));
        
        const selector = new Container({
            flexDirection: 'row', width: '100%', height: 48, alignItems: 'center',
            justifyContent: 'space-between', backgroundColor: COLORS.button, borderRadius: 8, padding: 4
        });
        group.add(selector);

        const createArrowBtn = (icon, delta) => {
            return new Container({
                width: 40, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', hover: { backgroundColor: COLORS.hover },
                onPointerEnter: (e) => UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, this.uiManager),
                onClick: (e) => {
                    UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, this.uiManager);
                    this.uiManager.changeLut(delta);
                }
            }).add(new Image({ src: icon, width: 32, height: 32, color: COLORS.text }));
        };

        selector.add(createArrowBtn('icons/chevron-left.svg', -1));
        this.lutNameText = new Text({
            text: "None", fontSize: 14, color: COLORS.text, width: 250, textAlign: 'center', wordBreak: 'break-all'
        });
        selector.add(this.lutNameText);
        selector.add(createArrowBtn('icons/chevron-right.svg', 1));
        this.container.add(group);
    }

    handlesKey(id) {
        return this.managedKeys.has(id);
    }

    async onValueChange(id, val, shouldSave) {
        const s = this.uiManager.stereoPlayer.stereoScreen;
        switch (id) {
            case 'color_brightness': s.setBrightness(val); break;
            case 'color_contrast': s.setContrast(val); break;
            case 'color_gamma': s.setGamma(val); break;
            case 'color_saturation': s.setSaturation(val); break;
            case 'color_hue': s.setHue(val); break;
            case 'color_lut': this.values.color_lut = val; break;
        }
        this.values[id] = val;
        if (shouldSave) await this.save();
    }

    async load() {
        const saved = storage.get('color');
        if (saved) Object.assign(this.values, saved);
        for (let id in this.values) {
            if (id === 'color_lut') continue;
            await this.uiManager.onSliderChange(id, this.values[id], false);
        }
    }

    async save() { await storage.set('color', this.values); }

    sync() {
        const trackWidth = 332, thumbWidth = 24;
        const data = this.values;
        for (let id in this.sliders) {
            const sl = this.sliders[id];
            if (data[id] === undefined) continue;
            const p = THREE.MathUtils.clamp((data[id] - sl.min) / (sl.max - sl.min), 0, 1);
            const margin = p * (trackWidth - thumbWidth);
            if (Math.abs((sl._lastMargin || 0) - margin) > 0.1) {
                sl.thumb.setProperties({ marginLeft: margin, backgroundColor: COLORS.accent });
                sl._lastMargin = margin;
            }
        }
        if (this.lutNameText) {
            const lutText = data.color_lut || "None";
            if (this._lastLutText !== lutText) {
                this.lutNameText.setProperties({ text: lutText });
                this._lastLutText = lutText;
            }
        }
        this._lastAlignIcon = UIUtils.updateAlignIcon(this.headerBtns?.alignBtn, this.uiManager, this._lastAlignIcon);
    }
}

export { ColorSettingsMenu };
