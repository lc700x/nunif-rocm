import { Container, Text, Image } from '@pmndrs/uikit';
import { COLORS, LIMITS, DEFAULTS, UI_CONFIG } from './constants.js';
import { UIUtils } from './ui_common.js';
import { storage } from './storage.js';
import * as THREE from 'three';

class EnvironmentSettingsMenu {
    constructor(uiManager, defaultFont) {
        this.uiManager = uiManager;
        this.managedKeys = new Set([
            'environment_tilt', 'environment_rotation', 'environment_intensity', 'environment_name', 'environment_model_name'
        ]);
        this.values = {
            environment_tilt: DEFAULTS.environment_tilt,
            environment_rotation: DEFAULTS.environment_rotation,
            environment_intensity: DEFAULTS.environment_intensity,
            environment_name: DEFAULTS.environment_name,
            environment_model_name: DEFAULTS.environment_model_name || "None"
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
            ["Tilt", "environment_tilt", LIMITS.environment_tiltMin, LIMITS.environment_tiltMax, DEFAULTS.environment_tilt],
            ["Rotation", "environment_rotation", LIMITS.environment_rotationMin, LIMITS.environment_rotationMax, DEFAULTS.environment_rotation],
            ["Brightness", "environment_intensity", LIMITS.environment_intensityMin, LIMITS.environment_intensityMax, DEFAULTS.environment_intensity]
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
        this.headerBtns = UIUtils.setupWindowHeader(this.container, "Env Settings", () => this.reset(), this.uiManager);
    }

    reset() {
        const defaults = {
            environment_rotation: DEFAULTS.environment_rotation,
            environment_tilt: DEFAULTS.environment_tilt,
            environment_intensity: DEFAULTS.environment_intensity
        };
        Object.entries(defaults).forEach(([id, val]) => this.uiManager.onSliderChange(id, val));

        this.uiManager.resetSkybox();
        this.uiManager.resetModel();
    }

    setupSelectors() {
        const envGroup = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 12,
            marginTop: 12
        });
        this.container.add(envGroup);

        const createSelector = (label, onDelta, textRef) => {
            const group = new Container({ flexDirection: 'column', gap: 4 });
            group.add(new Text({ text: label, fontSize: 16, color: COLORS.textDim }));
            
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
                        onDelta(delta);
                    }
                }).add(new Image({ src: icon, width: 32, height: 32, color: COLORS.text }));
            };

            selector.add(createArrowBtn('icons/chevron-left.svg', -1));
            const nameText = new Text({
                text: "None", fontSize: 14, color: COLORS.text, width: 250, textAlign: 'center', wordBreak: 'break-all'
            });
            this[textRef] = nameText;
            selector.add(nameText);
            selector.add(createArrowBtn('icons/chevron-right.svg', 1));
            return group;
        };

        envGroup.add(createSelector("Skybox", (d) => this.uiManager.changeSkybox(d), "skyboxNameText"));
        envGroup.add(createSelector("3D Model", (d) => this.uiManager.changeModel(d), "modelNameText"));
    }

    handlesKey(id) {
        return this.managedKeys.has(id);
    }

    async onValueChange(id, val, shouldSave) {
        const em = this.uiManager.stereoPlayer.environmentManager;
        switch (id) {
            case 'environment_rotation': em.setRotation(val); break;
            case 'environment_tilt': em.setTilt(val); break;
            case 'environment_intensity': em.setIntensity(val); break;
            case 'environment_name': this.values.environment_name = val; break;
            case 'environment_model_name': this.values.environment_model_name = val; break;
        }
        this.values[id] = val;
        if (shouldSave) await this.save();
    }

    async load() {
        const saved = storage.get('environment');
        if (saved) Object.assign(this.values, saved);
        for (let id in this.values) {
            if (id === 'environment_name' || id === 'environment_model_name') continue;
            await this.uiManager.onSliderChange(id, this.values[id], false);
        }
    }

    async save() { await storage.set('environment', this.values); }

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
        if (this.skyboxNameText) {
            const skyText = data.environment_name || "None";
            if (this._lastSkyText !== skyText) {
                this.skyboxNameText.setProperties({ text: skyText });
                this._lastSkyText = skyText;
            }
        }
        if (this.modelNameText) {
            const modelText = data.environment_model_name || "None";
            if (this._lastModelText !== modelText) {
                this.modelNameText.setProperties({ text: modelText });
                this._lastModelText = modelText;
            }
        }
        this._lastAlignIcon = UIUtils.updateAlignIcon(this.headerBtns?.alignBtn, this.uiManager, this._lastAlignIcon);
    }
}

export { EnvironmentSettingsMenu };
