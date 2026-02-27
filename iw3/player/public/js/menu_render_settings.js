import { Container, Text, Image } from '@pmndrs/uikit';
import { COLORS, DEFAULTS, UI_CONFIG } from './constants.js';
import { UIUtils } from './ui_common.js';
import { storage } from './storage.js';

class RenderSettingsMenu {
    constructor(uiManager, defaultFont) {
        this.uiManager = uiManager;
        this.managedKeys = new Set([
            'render_video_mipmap', 'render_antialias', 'render_ss', 'render_fps', 'render_font'
        ]);
        this.values = {
            render_video_mipmap: DEFAULTS.render_video_mipmap,
            render_antialias: DEFAULTS.render_antialias,
            render_ss: DEFAULTS.render_ss,
            render_fps: DEFAULTS.render_fps,
            render_font: DEFAULTS.render_font
        };

        this.container = new Container({
            flexDirection: 'column',
            backgroundColor: COLORS.bg,
            backgroundOpacity: 0.9,
            borderRadius: 16,
            borderWidth: 2,
            borderColor: COLORS.border,
            padding: 24,
            gap: 12,
            width: 400,
            display: 'none',
            position: 'absolute',
            marginLeft: UI_CONFIG.menuMarginLeft,
            marginTop: UI_CONFIG.menuMarginTop,
            fontFamily: defaultFont
        });

        this.setupHeader();

        const group = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 8,
            marginTop: 8
        });
        this.container.add(group);

        group.add(new Text({ text: "Browser reload required", fontSize: 14, color: COLORS.hint, marginBottom: 4 }));
        
        // Font Selector
        this.setupFontSelector(group);

        // FPS Selector
        this.setupFPSSelector(group);

        this.checkboxes = {};
        
        // Super Sampling (SS) Multi-choice
        const ssRow = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 6,
            marginBottom: 4
        });
        group.add(ssRow);
        ssRow.add(new Text({ text: "Super Sampling", fontSize: 16, color: COLORS.textDim }));
        
        const ssBtnGroup = new Container({
            flexDirection: 'row',
            width: '100%',
            gap: 12,
            height: 48,
            marginTop: 4
        });
        ssRow.add(ssBtnGroup);
        
        this.ssButtons = {};
        [1.0, 1.5, 2.0].forEach(factor => {
            const btn = new Container({
                flex: 1,
                height: '100%',
                borderRadius: 8,
                backgroundColor: COLORS.button,
                alignItems: 'center',
                justifyContent: 'center',
                paddingX: 12,
                cursor: 'pointer',
                hover: { backgroundColor: COLORS.hover },
                onPointerEnter: (e) => UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, this.uiManager),
                onClick: (e) => {
                    UIUtils.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, this.uiManager);
                    this.uiManager.onSliderChange('render_ss', factor);
                }
            });
            btn.add(new Text({ text: `${factor.toFixed(1)}x`, fontSize: 16, color: COLORS.text, width: '100%', textAlign: 'center' }));
            ssBtnGroup.add(btn);
            this.ssButtons[factor] = btn;
        });

        const configs = [
            { id: 'render_antialias', label: 'Antialias' },
            { id: 'render_video_mipmap', label: 'Video Mipmap' }
        ];

        configs.forEach(cfg => {
            const row = new Container({
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                height: 44
            });
            row.add(new Text({ text: cfg.label, fontSize: 18, color: COLORS.textDim }));
            
            const toggle = UIUtils.createButton('icons/square.svg', () => {
                this.uiManager.onSliderChange(cfg.id, !this.values[cfg.id]);
            }, this.uiManager, 22, 44);
            
            row.add(toggle.container);
            group.add(row);
            this.checkboxes[cfg.id] = toggle;
        });
    }

    setupHeader() {
        this.headerBtns = UIUtils.setupWindowHeader(this.container, "Render Settings", () => this.reset(), this.uiManager);
    }

    reset() {
        const defaults = {
            render_video_mipmap: DEFAULTS.render_video_mipmap,
            render_antialias: DEFAULTS.render_antialias,
            render_ss: DEFAULTS.render_ss,
            render_font: DEFAULTS.render_font,
            render_fps: DEFAULTS.render_fps
        };
        Object.entries(defaults).forEach(([id, val]) => this.uiManager.onSliderChange(id, val));
    }

    setupFontSelector(parent) {
        const group = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 6,
            marginBottom: 8
        });
        parent.add(group);
        group.add(new Text({ text: "Font / Language", fontSize: 16, color: COLORS.textDim }));

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
                    this.uiManager.changeFont(delta);
                }
            }).add(new Image({ src: icon, width: 32, height: 32, color: COLORS.text }));
        };

        selector.add(createArrowBtn('icons/chevron-left.svg', -1));
        this.fontNameText = new Text({
            text: "Auto",
            fontSize: 14,
            color: COLORS.text,
            width: 250,
            textAlign: 'center'
        });
        selector.add(this.fontNameText);
        selector.add(createArrowBtn('icons/chevron-right.svg', 1));

        this.languagesText = new Text({
            text: "",
            fontSize: 12,
            color: COLORS.textDim,
            marginTop: 4,
            textAlign: 'center',
            width: '100%'
        });
        group.add(this.languagesText);
    }

    setupFPSSelector(parent) {
        const group = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 6,
            marginBottom: 8
        });
        parent.add(group);
        group.add(new Text({ text: "Target Frame Rate", fontSize: 16, color: COLORS.textDim }));

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
                    this.uiManager.changeFPS(delta);
                }
            }).add(new Image({ src: icon, width: 32, height: 32, color: COLORS.text }));
        };

        selector.add(createArrowBtn('icons/chevron-left.svg', -1));
        this.fpsValueText = new Text({
            text: "Auto",
            fontSize: 16,
            color: COLORS.text,
            width: 250,
            textAlign: 'center'
        });
        selector.add(this.fpsValueText);
        selector.add(createArrowBtn('icons/chevron-right.svg', 1));
    }

    handlesKey(id) {
        return this.managedKeys.has(id);
    }

    async onValueChange(id, val, shouldSave) {
        const s = this.uiManager.stereoPlayer.stereoScreen;
        const p = this.uiManager.stereoPlayer;

        if (id === 'render_video_mipmap') {
            if (p.videoElement && val !== this.values.render_video_mipmap) {
                const currentPos = p.videoElement.currentTime;
                const format = s.currentStereoFormat;
                p.loadMedia(p.galleryManager.playingIndex, format).then(() => {
                    if (p.videoElement) p.videoElement.currentTime = currentPos;
                });
            }
        }

        this.values[id] = val;
        if (shouldSave) await this.save();
    }

    load() {
        const saved = storage.get('render');
        if (saved) Object.assign(this.values, saved);
        // Only mipmap needs immediate application if changed, others are handled by main.js on reload
    }

    async save() { await storage.set('render', this.values); }

    sync(metadata) {
        const data = this.values;
        for (let id in this.checkboxes) {
            const val = data[id];
            const cb = this.checkboxes[id];
            if (cb._lastVal !== val) {
                cb.image.setProperties({ 
                    src: val ? 'icons/square-check.svg' : 'icons/square.svg',
                    color: val ? COLORS.text : COLORS.hover
                });
                cb.setSelected(val);
                cb._lastVal = val;
            }
        }

        // Sync SS buttons
        const currentSS = data.render_ss;
        for (let factor in this.ssButtons) {
            const isSelected = parseFloat(factor) === currentSS;
            const btn = this.ssButtons[factor];
            if (btn._lastSelected !== isSelected) {
                btn.setProperties({
                    backgroundColor: isSelected ? COLORS.accent : COLORS.button
                });
                btn._lastSelected = isSelected;
            }
        }

        if (this.fontNameText) {
            const fontLabel = metadata?.currentFontLabel || "Auto";
            if (this._lastFontLabel !== fontLabel) {
                this.fontNameText.setProperties({ text: fontLabel });
                this._lastFontLabel = fontLabel;
            }
        }
        if (this.languagesText) {
            const fontLangs = metadata?.currentFontLanguages || "";
            if (this._lastFontLangs !== fontLangs) {
                this.languagesText.setProperties({ text: fontLangs });
                this._lastFontLangs = fontLangs;
            }
        }
        if (this.fpsValueText) {
            const fpsVal = this.values.render_fps || 0;
            const fpsStr = fpsVal === 0 ? "Auto" : `${fpsVal} fps`;
            if (this._lastFpsStr !== fpsStr) {
                this.fpsValueText.setProperties({ text: fpsStr });
                this._lastFpsStr = fpsStr;
            }
        }
        this._lastAlignIcon = UIUtils.updateAlignIcon(this.headerBtns?.alignBtn, this.uiManager, this._lastAlignIcon);
    }
}

export { RenderSettingsMenu };
