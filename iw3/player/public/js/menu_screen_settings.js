import { Container, Text } from '@pmndrs/uikit';
import { COLORS, LIMITS, DEFAULTS, UI_CONFIG, STEREO_FORMATS, SETTINGS_METADATA } from './constants.js';
import { UIUtils } from './ui_common.js';
import { storage } from './storage.js';
import * as THREE from 'three';

class ScreenSettingsMenu {
    constructor(uiManager, defaultFont) {
        this.uiManager = uiManager;
        this.managedKeys = new Set([
            'screen_tilt', 'screen_zoom', 'screen_eye_sep', 'screen_tx', 'screen_ty',
            'screen_curvature', 'screen_edge_fade', 'screen_bg_color', 'screen_height_index', 'screen_volume'
        ]);
        this.values = {
            screen_tilt: DEFAULTS.screen_tilt,
            screen_zoom: DEFAULTS.screen_zoom,
            screen_eye_sep: DEFAULTS.screen_eye_sep,
            screen_tx: DEFAULTS.screen_tx,
            screen_ty: DEFAULTS.screen_ty,
            screen_curvature: DEFAULTS.screen_curvature,
            screen_edge_fade: DEFAULTS.screen_edge_fade,
            screen_bg_color: DEFAULTS.screen_bg_color,
            screen_height_index: DEFAULTS.screen_height_index,
            screen_volume: DEFAULTS.screen_volume
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

        // Stereo Format Selection
        const formatGrid = new Container({
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 16,
            marginBottom: 16
        });
        this.container.add(formatGrid);

        this.formatButtons = {};
        const formats = [
            { id: STEREO_FORMATS.SBS_FULL, label: "SBS Full" },
            { id: STEREO_FORMATS.SBS_HALF, label: "SBS Half" },
            { id: STEREO_FORMATS.SBS_FULL_CROSS, label: "Cross" },
            { id: STEREO_FORMATS.TB_FULL, label: "TB Full" },
            { id: STEREO_FORMATS.TB_HALF, label: "TB Half" },
            { id: STEREO_FORMATS.FLAT, label: "Flat" }
        ];

        formats.forEach(f => {
            const btn = new Container({
                width: 110,
                height: 40,
                backgroundColor: COLORS.button,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                hover: { backgroundColor: COLORS.hover },
                onPointerEnter: (e) => UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, this.uiManager),
                onClick: (e) => {
                    UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, this.uiManager);
                    this.uiManager.onFormatChange(f.id);
                }
            });
            const txt = new Text({ text: f.label, fontSize: 14, color: COLORS.text });
            btn.add(txt);
            formatGrid.add(btn);

            const setSelected = (isSelected) => {
                if (btn._lastSelected === isSelected) return;
                btn._lastSelected = isSelected;

                btn.setProperties({
                    backgroundColor: isSelected ? COLORS.accent : COLORS.button,
                    hover: { backgroundColor: isSelected ? COLORS.accentHover : COLORS.hover }
                });
                txt.setProperties({ color: COLORS.text });
            };
            this.formatButtons[f.id] = { container: btn, setSelected };
        });

        this.sliders = {};
        const config = [
            ["Screen Size", "screen_height_index", LIMITS.screen_height_indexMin, LIMITS.screen_height_indexMax, DEFAULTS.screen_height_index, "[Grip + Stick X]"],
            ["Tilt", "screen_tilt", LIMITS.screen_tiltMin, LIMITS.screen_tiltMax, DEFAULTS.screen_tilt, "[Trigger + Tilt]"],
            ["Distance", "screen_zoom", -LIMITS.screen_zoomMax, -LIMITS.screen_zoomMin, DEFAULTS.screen_zoom, "[Stick Y]"],
            ["Scale", "screen_eye_sep", LIMITS.screen_eye_sepMin, LIMITS.screen_eye_sepMax, DEFAULTS.screen_eye_sep, "[Grip + Stick Y]"],
            ["Pos X", "screen_tx", -LIMITS.screen_txMax, LIMITS.screen_txMax, DEFAULTS.screen_tx, "[Grip + Move]"],
            ["Pos Y", "screen_ty", -LIMITS.screen_tyMax, LIMITS.screen_tyMax, DEFAULTS.screen_ty, "[Grip + Move]"],
            ["Curvature", "screen_curvature", LIMITS.screen_curvatureMin, LIMITS.screen_curvatureMax, DEFAULTS.screen_curvature, null],
            ["Edge Fade", "screen_edge_fade", LIMITS.screen_edge_fadeMin, LIMITS.screen_edge_fadeMax, DEFAULTS.screen_edge_fade, null],
            ["Background", "screen_bg_color", LIMITS.screen_bg_colorMin, LIMITS.screen_bg_colorMax, DEFAULTS.screen_bg_color, null],
        ];

        config.forEach(([label, id, min, max, defVal, shortcut]) => {
            this.sliders[id] = UIUtils.createSlider(
                this.container, 
                label, 
                id, 
                min, 
                max, 
                this.uiManager,
                () => this.uiManager.onSliderChange(id, defVal),
                shortcut
            );
        });
    }

    async reset() {
        // 1. Delete file-specific settings for the 'screen' group
        const currentItem = this.uiManager.stereoPlayer.galleryManager.getCurrentItem();
        if (currentItem) {
            this.uiManager.debugLogInstance.log(`[Config] Resetting screen settings group`);
            const updates = {};
            Object.entries(SETTINGS_METADATA).forEach(([key, meta]) => {
                if (meta.group === 'screen') {
                    updates[key] = undefined; // Request removal
                }
            });
            await storage.updateFileConfig(currentItem, updates);
            this.uiManager.dirtyGroups.delete('screen');
        }

        // 2. Apply default values to UI (without saving back to file config)
        const defaults = {
            screen_tilt: DEFAULTS.screen_tilt,
            screen_zoom: DEFAULTS.screen_zoom,
            screen_eye_sep: DEFAULTS.screen_eye_sep,
            screen_tx: DEFAULTS.screen_tx,
            screen_ty: DEFAULTS.screen_ty,
            screen_curvature: DEFAULTS.screen_curvature,
            screen_height_index: DEFAULTS.screen_height_index,
            screen_edge_fade: DEFAULTS.screen_edge_fade,
            screen_bg_color: DEFAULTS.screen_bg_color
        };

        for (const [id, val] of Object.entries(defaults)) {
            await this.uiManager.onSliderChange(id, val, false);
        }
        
        // Ensure UI is synced
        this.uiManager.syncUI(true);
    }

    handlesKey(id) {
        return this.managedKeys.has(id);
    }

    async onValueChange(id, val, shouldSave) {
        const s = this.uiManager.stereoPlayer.stereoScreen;
        switch (id) {
            case 'screen_tilt': this.uiManager.stereoPlayer.setRotationX(val * Math.PI / 180); break;
            case 'screen_zoom': s.setZoom(val); break;
            case 'screen_eye_sep': s.setEyeSeparation(val); break;
            case 'screen_curvature': s.setCurvature(val); break;
            case 'screen_edge_fade': s.setEdgeFade(val); break;
            case 'screen_tx': s.setTranslation(val, s.currentScreenY); break;
            case 'screen_ty': s.setTranslation(s.currentScreenX, val); break;
            case 'screen_bg_color': this.uiManager.stereoPlayer.setBackgroundLevel(val); break;
            case 'screen_height_index': {
                const index = Math.round(val);
                const effectiveHeight = Math.pow(2, index);
                if (effectiveHeight !== s.physicalScreenHeight) {
                    s.setPhysicalScreenHeight(effectiveHeight);
                    // Reset translation only when manually changing screen size via UI
                    if (shouldSave) {
                        await this.uiManager.onSliderChange('screen_tx', 0, false);
                        await this.uiManager.onSliderChange('screen_ty', 0, false);
                    }
                }
                this.uiManager.screenHeightIndex = index;
                break;
            }
            case 'screen_volume':
                this.uiManager.currentVolume = val;
                if (this.uiManager.stereoPlayer.videoElement) this.uiManager.stereoPlayer.videoElement.volume = val;
                break;
        }
        this.values[id] = val;
        if (shouldSave) await this.save();
    }

    async load() {
        const saved = storage.get('screen');
        if (saved) Object.assign(this.values, saved);
        for (let id in this.values) await this.uiManager.onSliderChange(id, this.values[id], false);
    }

    async save() { await storage.set('screen', this.values); }

    sync(vals) {
        const trackWidth = 332, thumbWidth = 24;
        const data = this.values;
        const metadata = vals || {};
        for (let id in this.sliders) {
            const sl = this.sliders[id];
            if (data[id] === undefined) continue;
            let val = data[id], min = sl.min, max = sl.max;
            if ((id === 'screen_tx' || id === 'screen_ty') && metadata.effective_physical_screen_height) {
                const limit = LIMITS.screen_txMax * metadata.effective_physical_screen_height * (id === 'screen_tx' ? metadata.aspect_ratio : 1.0);
                min = -limit; max = limit;
            }
            if (id === 'screen_height_index') { 
                val = Math.round(val);
                min = LIMITS.screen_height_indexMin; 
                max = LIMITS.screen_height_indexMax; 
            }
            const p = THREE.MathUtils.clamp((val - min) / (max - min), 0, 1);
            const margin = p * (trackWidth - thumbWidth);
            if (Math.abs((sl._lastMargin || 0) - margin) > 0.1) {
                sl.thumb.setProperties({ marginLeft: margin, backgroundColor: COLORS.accent });
                sl._lastMargin = margin;
            }
        }

        // Hide Background slider if a skybox (HDR/EXR) is active
        if (this.sliders.screen_bg_color) {
            const isSkyboxNone = this.uiManager.skyboxes[this.uiManager.currentSkyboxIndex] === "None";
            const displayMode = isSkyboxNone ? 'flex' : 'none';
            if (this._lastBgDisplay !== displayMode) {
                this.sliders.screen_bg_color.group.setProperties({ display: displayMode });
                this._lastBgDisplay = displayMode;
            }
        }

        const currentFormat = metadata.currentFormat || this.uiManager.stereoPlayer.stereoScreen.currentStereoFormat;
        for (let id in this.formatButtons) {
            const btn = this.formatButtons[id];
            if (btn.setSelected) btn.setSelected(id === currentFormat);
        }

        this._lastAlignIcon = UIUtils.updateAlignIcon(this.headerBtns?.alignBtn, this.uiManager, this._lastAlignIcon);
    }

    setupHeader() {
        this.headerBtns = UIUtils.setupWindowHeader(this.container, "Screen Settings", () => this.reset(), this.uiManager);
    }
}

export { ScreenSettingsMenu };
