import * as THREE from 'three';
import { INPUT_ACTIONS, UI_CONFIG, LIMITS } from './constants.js';
import { UIUtils } from './ui_common.js';

/**
 * Normalizes inputs from VR controllers, Mouse, and Keyboard into semantic Actions.
 */
class InputManager {
    constructor(stereoPlayer, uiManager) {
        this.player = stereoPlayer;
        this.ui = uiManager;

        // VR Controller State
        this.isStickReset = [true, true];
        this.activeStickAxis = [null, null]; // 'x' or 'y'
        this.isMenuButtonPressed = [false, false];
        this.isAButtonPressed = [false, false];

        // Feedback State
        this._atLimit = {}; // Tracks limit feedback for joysticks and translation

        // Keyboard State
        this.isShiftDown = false;

        // Mouse State
        this.isRotating = false;
        this.isTranslating = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupKeyboardEvents();
        this.setupMouseEvents();
    }

    setupMouseEvents() {
        const el = this.player.renderer.domElement;
        el.addEventListener('contextmenu', (e) => e.preventDefault());
        el.addEventListener('mousedown', (e) => this.onMouseDown(e));
        el.addEventListener('mousemove', (e) => this.onMouseMove(e));
        el.addEventListener('mouseup', () => { 
            if (this.isRotating || this.isTranslating) {
                if (this.ui) this.ui.saveSettings();
            }
            this.isRotating = this.isTranslating = false; 
        });
    }

    onMouseDown(event) {
        const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
        this.player.raycaster.setFromCamera(mouse, this.player.camera);
        if (this.player.raycaster.intersectObjects(this.ui.getInteractableMeshes(), true).length > 0) return;
        
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        if (event.button === 0) { 
            if (this.isShiftDown || event.shiftKey) this.isTranslating = true; 
            else this.isRotating = true; 
        }
    }

    onMouseMove(event) {
        const dx = event.clientX - this.lastMouseX;
        const dy = event.clientY - this.lastMouseY;
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;

        if (this.isRotating) {
            this.player.setRotationX(this.player.rotation.x - dy * 0.01);
            this.ui.onSliderChange('screen_tilt', this.player.rotation.x * 180 / Math.PI, false);
        } else if (this.isTranslating) {
            this.player.stereoScreen.translateScreen(dx * 0.005, -dy * 0.005);
            this.ui.onSliderChange('screen_tx', this.player.stereoScreen.currentScreenX, false);
            this.ui.onSliderChange('screen_ty', this.player.stereoScreen.currentScreenY, false);
        }
    }

    setupKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            switch (e.code) {
                case 'Space': e.preventDefault(); this.dispatch(INPUT_ACTIONS.MENU_TOGGLE, { autoExplorer: false }); break;
                case 'ArrowLeft': this.dispatch(this.player.videoElement ? INPUT_ACTIONS.SEEK_BWD : INPUT_ACTIONS.NAV_PREV); break;
                case 'ArrowRight': this.dispatch(this.player.videoElement ? INPUT_ACTIONS.SEEK_FWD : INPUT_ACTIONS.NAV_NEXT); break;
                case 'ArrowUp': this.dispatch(INPUT_ACTIONS.ZOOM_IN); break;
                case 'ArrowDown': this.dispatch(INPUT_ACTIONS.ZOOM_OUT); break;
                case 'KeyQ': this.dispatch(INPUT_ACTIONS.EYE_SEP_DEC); break;
                case 'KeyE': this.dispatch(INPUT_ACTIONS.EYE_SEP_INC); break;
                case 'ShiftLeft': case 'ShiftRight': this.isShiftDown = true; break;
            }
            if (this.ui) this.ui.saveSettings();
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.isShiftDown = false;
        });
        window.addEventListener('wheel', (e) => {
            this.dispatch(e.deltaY > 0 ? INPUT_ACTIONS.ZOOM_OUT : INPUT_ACTIONS.ZOOM_IN);
            if (this.ui) this.ui.saveSettings();
        }, { passive: true });
    }

    update(delta) {
        if (this.player.isXRActive) {
            this.handleXRUpdate(delta);
        }
    }

    handleXRUpdate(delta) {
        // 1. Controller Rotation (Tilt)
        if (this.player.isControllerRotating && this.player.activeRotationController && this.player.renderer.xr.isPresenting) {
            const quat = new THREE.Quaternion();
            this.player.activeRotationController.getWorldQuaternion(quat);
            const currRotX = new THREE.Euler().setFromQuaternion(quat, 'YXZ').x;
            const newTilt = (this.player.initialRotationX + (currRotX - this.player.initialControllerRotationX)) * 180 / Math.PI;
            this.ui.onSliderChange('screen_tilt', newTilt, false);
        }

        // 2. Controller Translation (Squeeze + Movement)
        if (this.player.isControllerTranslating && this.player.activeTranslationController && this.player.renderer.xr.isPresenting) {
            const pos = new THREE.Vector3();
            this.player.activeTranslationController.getWorldPosition(pos);
            const s = this.player.stereoScreen;
            const scale = s.physicalScreenHeight;
            const deltaPos = pos.clone().sub(this.player.initialControllerPosition).multiplyScalar(UI_CONFIG.translationSensitivity * scale);
            
            const targetX = this.player.initialScreenX + deltaPos.x;
            const targetY = this.player.initialScreenY + deltaPos.y;
            
            // Limit checks for translation haptics
            const xLimit = LIMITS.screen_txMax * s.physicalScreenHeight * s.aspectRatio;
            const yLimit = LIMITS.screen_tyMax * s.physicalScreenHeight;
            
            const isAtXLimit = Math.abs(targetX) >= xLimit - 0.001;
            const isAtYLimit = Math.abs(targetY) >= yLimit - 0.001;

            if (isAtXLimit || isAtYLimit) {
                const cIdx = this.player.controllers.indexOf(this.player.activeTranslationController);
                if (cIdx !== -1 && !this._atLimit['screen_pos']) {
                    const pointer = this.ui.xrPointers[cIdx];
                    if (pointer) UIUtils.vibratePointer(pointer.id, UI_CONFIG.hapticLimitIntensity, UI_CONFIG.hapticLimitDuration, this.ui);
                    this._atLimit['screen_pos'] = true;
                }
            } else {
                this._atLimit['screen_pos'] = false;
            }

            this.ui.onSliderChange('screen_tx', targetX, false);
            this.ui.onSliderChange('screen_ty', targetY, false);
        }

        for (let i = 0; i < 2; i++) {
            const controller = this.player.controllers[i];
            const gamepad = this.player.gamepads[i];
            if (!controller || !gamepad) continue;

            let stickX = gamepad.axes[2];
            let stickY = gamepad.axes[3];
            const absX = Math.abs(stickX);
            const absY = Math.abs(stickY);

            if (this.activeStickAxis[i] === null) {
                if (absX > 0.5 || absY > 0.5) this.activeStickAxis[i] = (absX > absY) ? 'x' : 'y';
            } else {
                if (absX < 0.1 && absY < 0.1) { 
                    this.activeStickAxis[i] = null; 
                    this.isStickReset[i] = true; 
                    // Save settings when stick is released
                    if (this.ui) this.ui.saveSettings();
                }
            }

            const hitInfo = this.getUIContext(controller);
            
            if (this.activeStickAxis[i] === 'y') {
                if (hitInfo.isExplorer) {
                    if (this.isStickReset[i]) {
                        this.dispatch(stickY > 0 ? INPUT_ACTIONS.PAGE_NEXT : INPUT_ACTIONS.PAGE_PREV, { controllerIndex: i });
                        this.isStickReset[i] = false;
                    }
                } else if (!hitInfo.isUI) {
                    const params = { delta, controllerIndex: i };
                    if (this.player.isControllerTranslating && this.player.activeTranslationController === controller) {
                        this.dispatch(-stickY > 0 ? INPUT_ACTIONS.EYE_SEP_INC : INPUT_ACTIONS.EYE_SEP_DEC, params);
                    } else {
                        this.dispatch(-stickY > 0 ? INPUT_ACTIONS.ZOOM_IN : INPUT_ACTIONS.ZOOM_OUT, params);
                    }
                }
            }

            if (this.activeStickAxis[i] === 'x') {
                if (this.player.isControllerTranslating && this.player.activeTranslationController === controller) {
                    if (this.isStickReset[i]) {
                        this.dispatch(stickX > 0 ? INPUT_ACTIONS.SCREEN_SIZE_INC : INPUT_ACTIONS.SCREEN_SIZE_DEC, { controllerIndex: i });
                        this.isStickReset[i] = false;
                    }
                } else if (!hitInfo.isUI && !gamepad.buttons[0].pressed && !gamepad.buttons[1].pressed) {
                    if (this.isStickReset[i]) {
                        const params = { controllerIndex: i };
                        if (this.player.videoElement) this.dispatch(stickX > 0 ? INPUT_ACTIONS.SEEK_FWD : INPUT_ACTIONS.SEEK_BWD, params);
                        else this.dispatch(stickX > 0 ? INPUT_ACTIONS.NAV_NEXT : INPUT_ACTIONS.NAV_PREV, params);
                        this.isStickReset[i] = false;
                    }
                }
            }

            const menuPressed = gamepad.buttons[5]?.value > 0.5;
            if (menuPressed && !this.isMenuButtonPressed[i]) this.dispatch(INPUT_ACTIONS.MENU_TOGGLE, { autoExplorer: true });
            this.isMenuButtonPressed[i] = menuPressed;

            const aPressed = gamepad.buttons[4]?.pressed || gamepad.buttons[4]?.value > 0.5;
            if (aPressed && !this.isAButtonPressed[i]) this.dispatch(INPUT_ACTIONS.PLAY_PAUSE, { controllerIndex: i });
            this.isAButtonPressed[i] = aPressed;

            if (this.player.controllerRays[i]?.visible) {
                this.player.controllerRays[i].scale.z = hitInfo.isUI ? (hitInfo.distance / 5.0) : 1.0;
            }
        }
    }

    getUIContext(controller) {
        if (!this.ui.visible) return { isUI: false, isExplorer: false, distance: 0 };
        
        // 1. Primary check: StereoPlayer's raycaster
        const intersects = this.player.checkUIHit(controller);
        let isUI = intersects.length > 0;
        let distance = isUI ? intersects[0].distance : 0;

        // 2. Fallback: Check uikit's own pointer intersections
        // This prevents the visual ray from penetrating the UI when uikit's 
        // internal meshes are in a state that Three's default raycaster misses.
        const cIdx = this.player.controllers.indexOf(controller);
        if (!isUI && cIdx !== -1 && this.ui.xrPointers[cIdx]) {
            const uiIntersects = this.ui.xrPointers[cIdx].intersections;
            if (uiIntersects && uiIntersects.length > 0) {
                isUI = true;
                distance = uiIntersects[0].distance;
            }
        }

        let isExplorer = false;
        if (isUI && this.ui.activeSubMenu === this.ui.explorer) {
            // Check if we hit the explorer specifically
            const targets = intersects.length > 0 ? intersects : this.ui.xrPointers[cIdx].intersections;
            isExplorer = targets && targets.some(ins => {
                let o = ins.object;
                while (o) { if (o === this.ui.explorer.container) return true; o = o.parent; }
                return false;
            });
        }
        return { isUI, isExplorer, distance };
    }

    dispatch(action, params = {}) {
        const delta = params.delta || 16;
        const s = this.player.stereoScreen;
        const cIdx = params.controllerIndex;
        const u = this.ui;
        
        let changed = true;
        let id = null;

        switch (action) {
            case INPUT_ACTIONS.MENU_TOGGLE: {
                const autoExplorer = params.autoExplorer ?? false;
                const cIdx = params.controllerIndex ?? -1;
                if (!u.isAnyMenuVisible()) {
                    u.showMainMenu(cIdx);
                    if (autoExplorer) u.toggleExplorerVisibility();
                } else {
                    if (autoExplorer) {
                        if (u.activeSubMenu === u.explorer) {
                            u.hideMainMenu();
                        } else {
                            u.toggleExplorerVisibility();
                        }
                    } else {
                        u.toggleMainMenuVisibility();
                    }
                }
                this.player.toggleControllerUIVisibility(u.isAnyMenuVisible());
                break;
            }
            case INPUT_ACTIONS.NAV_NEXT:
            case INPUT_ACTIONS.NAV_PREV: {
                const dir = (action === INPUT_ACTIONS.NAV_NEXT) ? 1 : -1;
                const next = this.player.galleryManager.getNextIndex(dir);
                if (next !== -1) {
                    this.player.loadMedia(next);
                } else if (cIdx !== undefined) {
                    const pointer = u.xrPointers[cIdx];
                    if (pointer) UIUtils.vibratePointer(pointer.id, UI_CONFIG.hapticLimitIntensity, UI_CONFIG.hapticLimitDuration, u);
                }
                break;
            }
            case INPUT_ACTIONS.PAGE_NEXT:
            case INPUT_ACTIONS.PAGE_PREV: {
                const pDir = (action === INPUT_ACTIONS.PAGE_NEXT) ? 1 : -1;
                const prevPage = u.currentPage;
                u.changePage(pDir);
                if (u.currentPage === prevPage && cIdx !== undefined) {
                    const pointer = u.xrPointers[cIdx];
                    if (pointer) UIUtils.vibratePointer(pointer.id, UI_CONFIG.hapticLimitIntensity, UI_CONFIG.hapticLimitDuration, u);
                }
                break;
            }
            case INPUT_ACTIONS.ZOOM_IN: 
                changed = s.zoomScreen(1, delta); id = 'screen_zoom';
                u.onSliderChange(id, s.currentZoom, false);
                break;
            case INPUT_ACTIONS.ZOOM_OUT: 
                changed = s.zoomScreen(-1, delta); id = 'screen_zoom';
                u.onSliderChange(id, s.currentZoom, false);
                break;
            case INPUT_ACTIONS.EYE_SEP_INC: 
                changed = s.slideEyeSeparation(1, delta); id = 'screen_eye_sep';
                u.onSliderChange(id, s.currentEyeSeparation, false);
                break;
            case INPUT_ACTIONS.EYE_SEP_DEC: 
                changed = s.slideEyeSeparation(-1, delta); id = 'screen_eye_sep';
                u.onSliderChange(id, s.currentEyeSeparation, false);
                break;
            case INPUT_ACTIONS.SCREEN_SIZE_INC:
            case INPUT_ACTIONS.SCREEN_SIZE_DEC: {
                const sizeDir = (action === INPUT_ACTIONS.SCREEN_SIZE_INC) ? 1 : -1;
                // Round to ensure we start from an integer step
                const currentSizeIdx = Math.round(u.screenSettings.values.screen_height_index);
                const nextSizeIdx = THREE.MathUtils.clamp(currentSizeIdx + sizeDir, LIMITS.screen_height_indexMin, LIMITS.screen_height_indexMax);
                if (nextSizeIdx !== currentSizeIdx) {
                    u.onSliderChange('screen_height_index', nextSizeIdx, true);
                    u.showNotification(`Screen Size: ${nextSizeIdx}`, 1000);
                } else {
                    changed = false; id = 'screen_height_index';
                }
                break;
            }
            case INPUT_ACTIONS.SEEK_FWD: 
                if (this.player.videoElement) {
                    this.player.seek(this.player.videoElement.currentTime + 10);
                    this.player.savePlaybackPosition();
                }
                break;
            case INPUT_ACTIONS.SEEK_BWD: 
                if (this.player.videoElement) {
                    this.player.seek(this.player.videoElement.currentTime - 10);
                    this.player.savePlaybackPosition();
                }
                break;
            case INPUT_ACTIONS.PLAY_PAUSE:
                if (this.player.videoElement) {
                    if (this.player.videoElement.paused) {
                        this.player.play();
                    } else {
                        this.player.pause();
                    }
                }
                break;
        }

        if (id && !changed && cIdx !== undefined) {
            if (!this._atLimit[id]) {
                const pointer = u.xrPointers[cIdx];
                if (pointer) UIUtils.vibratePointer(pointer.id, UI_CONFIG.hapticLimitIntensity, UI_CONFIG.hapticLimitDuration, u);
                this._atLimit[id] = true;
            }
        } else if (id && changed) {
            this._atLimit[id] = false;
        }
    }
}

export { InputManager };
