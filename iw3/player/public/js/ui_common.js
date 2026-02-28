import { Container, Image, Text } from '@pmndrs/uikit';
import { COLORS, UI_CONFIG } from './constants.js';

/**
 * Common UI building utilities to be used across different menu components.
 */
export const UIUtils = {
    vibratePointer(pointerId, intensity, duration, uiManager) {
        const index = uiManager.xrPointers.findIndex(p => p && p.id === pointerId);
        if (index !== -1) {
            const gamepad = uiManager.stereoPlayer.gamepads[index];
            if (gamepad?.hapticActuators?.[0]) {
                gamepad.hapticActuators[0].pulse(intensity, duration);
            }
        }
    },

    createButton(icon, onClick, uiManager, iconSize = 44, btnSize = 72, _id = null) {
        const b = new Container({
            width: btnSize,
            height: btnSize,
            backgroundColor: COLORS.button,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            hover: { backgroundColor: COLORS.hover },
            active: { backgroundColor: COLORS.accent },
            onPointerEnter: (e) => {
                // Prevent vibration if the UI is not visible
                if (!uiManager.visible) return;
                this.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, uiManager);
            },
            onClick: (e) => {
                if (!uiManager.visible) return;
                this.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, uiManager);
                onClick();
            }
        });
        const img = new Image({ src: icon, width: iconSize, height: iconSize, color: COLORS.text });
        b.add(img);
        
        let _lastSelected = null;
        const setSelected = (isSelected) => {
            if (_lastSelected === isSelected) return;
            _lastSelected = isSelected;

            b.setProperties({
                backgroundColor: isSelected ? COLORS.accent : COLORS.button,
                hover: { backgroundColor: isSelected ? COLORS.accentHover : COLORS.hover }
            });
            img.setProperties({ color: isSelected ? COLORS.text : COLORS.hover });
        };

        return { container: b, image: img, setSelected };
    },

    createSlider(container, label, id, min, max, uiManager, onReset = null, shortcut = null) {
        const group = new Container({
            flexDirection: 'column',
            width: '100%',
            gap: 6,
            marginTop: 12,
        });

        const labelRow = new Container({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingRight: 4
        });
        group.add(labelRow);

        const labelGroup = new Container({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
        });
        labelRow.add(labelGroup);

        labelGroup.add(new Text({
            text: label,
            fontSize: 16,
            color: COLORS.textDim,
        }));

        if (shortcut) {
            labelGroup.add(new Text({
                text: shortcut,
                fontSize: 12,
                color: COLORS.hint,
            }));
        }

        if (onReset) {
            const resetBtn = new Container({
                width: 24,
                height: 24,
                borderRadius: 4,
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                hover: { backgroundColor: COLORS.hover },
                onPointerEnter: (e) => {
                    if (!uiManager.visible) return;
                    this.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, uiManager);
                },
                onClick: (e) => {
                    if (!uiManager.visible) return;
                    this.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, uiManager);
                    onReset();
                }
            });
            resetBtn.add(new Image({ src: 'icons/restore.svg', width: 16, height: 16, color: COLORS.textDim }));
            labelRow.add(resetBtn);
        }

        const track = new Container({
            width: 332,
            height: 16,
            backgroundColor: COLORS.track,
            borderRadius: 8,
            cursor: 'pointer',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            alignSelf: 'center',
            overflow: 'visible',
            onPointerDown: (e) => {
                if (!uiManager.visible) return;
                this.vibratePointer(e.pointerId, UI_CONFIG.hapticHoverIntensity, UI_CONFIG.hapticHoverDuration, uiManager);
            },
            onClick: (e) => {
                if (!uiManager.visible) return;
                this.vibratePointer(e.pointerId, UI_CONFIG.hapticClickIntensity, UI_CONFIG.hapticClickDuration, uiManager);
                uiManager.handleSlider(e, track, id, min, max, true);
            },
            onPointerMove: (e) => {
                if (!uiManager.visible) return;
                e.buttons > 0 && uiManager.handleSlider(e, track, id, min, max, false);
            },
            onPointerUp: (_e) => {
                if (!uiManager.visible) return;
                uiManager.saveSettings();
            },
            onPointerLeave: (e) => {
                // If dragging and pointer leaves the track, save the last value
                if (!uiManager.visible) return;
                if (e.buttons > 0) uiManager.saveSettings();
            },
        });
        
        const thumb = new Container({
            width: 24,
            height: 24,
            backgroundColor: COLORS.accent,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: 0xffffff,
        });
        track.add(thumb);
        group.add(track);
        container.add(group);
        
        return { group, thumb, min, max };
    },

    createSeparator(width = 2, height = 40, props = {}) {
        return new Container({ 
            width: width, 
            height: height, 
            backgroundColor: COLORS.separator,
            ...props
        });
    },

    setupWindowHeader(container, title, onReset, uiManager) {
        const header = new Container({
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginBottom: 8
        });
        
        header.add(new Text({ text: title, fontSize: 24, color: COLORS.text }));

        const rightGroup = new Container({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
        });
        header.add(rightGroup);

        const alignBtn = this.createButton('icons/square-arrow-right.svg', () => uiManager.toggleMenuAlignment(), uiManager, 22, 48);
        rightGroup.add(alignBtn.container);
        
        rightGroup.add(this.createButton('icons/restore.svg', onReset, uiManager, 22, 48).container);
        container.add(header);

        return { alignBtn };
    },

    updateAlignIcon(alignBtn, uiManager, lastIconState) {
        if (!alignBtn) return lastIconState;
        const isRight = uiManager.menuAlignment === 'right';
        const icon = isRight ? 'icons/square-arrow-left.svg' : 'icons/square-arrow-right.svg';
        if (lastIconState !== icon) {
            alignBtn.image.setProperties({ src: icon });
            return icon;
        }
        return lastIconState;
    }
};

export const ThreeUtils = {
    /**
     * Recursively disposes of a Three.js object and its children.
     * It handles geometries, materials, and textures.
     * @param {THREE.Object3D} obj - The object to dispose.
     * @param {THREE.Object3D} parent - Optional parent to remove the object from first.
     */
    disposeObject(obj, parent = null) {
        if (!obj) return;
        
        // 1. Remove from parent first to avoid rendering glitches
        if (parent) {
            parent.remove(obj);
        } else if (obj.parent) {
            obj.parent.remove(obj);
        }

        // 2. Recursively dispose resources
        obj.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();

                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach(m => {
                        // Dispose all textures in the material
                        for (const key in m) {
                            if (m[key] && m[key].isTexture) {
                                m[key].dispose();
                            }
                        }
                        m.dispose();
                    });
                }
            }
        });
    }
};
