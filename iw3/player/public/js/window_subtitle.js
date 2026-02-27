import * as THREE from 'three';
import { DEFAULTS } from './constants.js';

class SubtitleWindow extends THREE.Group {
    constructor() {
        super();

        // Canvas for subtitle rendering
        // Use a wide enough base canvas to support ultra-wide screens
        this.canvas = document.createElement('canvas');
        this.canvas.width = 2048; // Higher resolution for wider screens
        this.canvas.height = 512; // Increased from 256 to support more lines/larger font
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        // Base geometry is 1x1, we will scale it
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false,
        });

        // Split into Left and Right meshes for stereo disparity
        this.meshL = new THREE.Mesh(geometry, material);
        this.meshR = new THREE.Mesh(geometry, material);

        this.meshL.renderOrder = this.meshR.renderOrder = 2000;
        this.meshL.raycast = this.meshR.raycast = () => {};

        // Layer 1 is Left Eye, Layer 2 is Right Eye in Three.js WebXR
        this.meshL.layers.set(1);
        this.meshR.layers.set(2);

        // Also enable Layer 0 for meshL to show it in non-XR mode
        this.meshL.layers.enable(0);

        this.add(this.meshL);
        this.add(this.meshR);

        this.visible = false;
        this.lastText = "";
        this.lastFontSize = DEFAULTS.subtitle_font_size;
        this.currentAspectRatio = 1.0;
        this.physicalScreenHeight = 1.0;
        this.lastIsXR = null;
    }

    /**
     * Positions and scales the subtitle window relative to the stereo screen.
     * @param {Object} screen - Current state of StereoScreen { aspectRatio, screenHeight, currentScreenX, currentScreenY, currentZoom }
     * @param {Object} settings - Current subtitle settings { y, z, scale, disparity }
     * @param {boolean} isVisible - Whether subtitles should be shown
     */
    updateLayout(screen, settings, isVisible) {
        if (!isVisible) {
            this.visible = false;
            return;
        }

        // 1. Calculate and Apply Mesh Scale
        this.updateMeshScale(screen.aspectRatio, screen.physicalScreenHeight);

        // 2. Redraw text if font size scale changed
        if (this.lastFontSize !== settings.scale) {
            const text = this.lastText;
            this.lastText = ""; // Force redraw
            this.updateText(text, settings.scale);
        }

        // 3. Calculate Group Position (World coordinates)
        // Ratio of height to width is 512 / 2048 = 0.25
        const subMeshHeight = (screen.aspectRatio * 0.8 * screen.physicalScreenHeight) * (512 / 2048);

        // Y: User setting is the TOP of the subtitle block.
        // Subtract half height because Three.js positions meshes from their center.
        const yPos = screen.currentScreenY + (settings.y * screen.physicalScreenHeight) - (subMeshHeight * 0.5);

        // Z: Screen Zoom + Depth offset
        const zPos = screen.currentZoom + settings.z;

        this.position.set(screen.currentScreenX, yPos, zPos);

        // 4. Apply Disparity (Stereo separation)
        const halfDisparity = (settings.disparity || 0) * 0.5;
        this.meshL.position.x = -halfDisparity;
        this.meshR.position.x = halfDisparity;

        this.visible = true;
    }

    /**
     * Toggles Layer 0 visibility for PC mode.
     */
    updateEyeVisibility(isXR) {
        if (isXR !== this.lastIsXR) {
            if (isXR) {
                // In XR, Layer 0 must be disabled so subtitles are only seen through Layer 1/2
                this.meshL.layers.disable(0);
                this.meshR.layers.disable(0);
                // Only show right mesh if left mesh is currently active
                this.meshR.visible = this.meshL.visible;
            } else {
                // In PC, only show the left eye subtitle on Layer 0
                this.meshL.layers.enable(0);
                this.meshR.layers.disable(0);
                this.meshR.visible = false;
            }
            this.lastIsXR = isXR;
        }
    }

    /**
     * Updates the mesh sizes based on aspect ratio and physical screen height.
     * Width is fixed to 80% of screen width.
     */
    updateMeshScale(aspectRatio, physicalScreenHeight) {
        if (this.currentAspectRatio === aspectRatio && this.physicalScreenHeight === physicalScreenHeight) return;
        this.currentAspectRatio = aspectRatio;
        this.physicalScreenHeight = physicalScreenHeight;
        
        // Target width is 80% of screen width
        const targetWidth = aspectRatio * 0.8 * physicalScreenHeight;
        const targetHeight = targetWidth * (512 / 2048); // Keep canvas aspect ratio (4:1)
        
        this.meshL.scale.set(targetWidth, targetHeight, 1);
        this.meshR.scale.set(targetWidth, targetHeight, 1);
        
        // Retrigger text wrap if aspect ratio changed
        if (this.lastText) {
            const t = this.lastText;
            const s = this.lastFontSize;
            this.lastText = ""; 
            this.updateText(t, s);
        }
    }

    /**
     * Splits text including CJK characters that don't use spaces.
     */
    wrapTextMultiLang(text, maxWidth) {
        const lines = [];
        const paragraphs = text.split('\n');
        
        for (const paragraph of paragraphs) {
            let currentLine = '';
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const testLine = currentLine + char;
                const metrics = this.ctx.measureText(testLine);
                
                if (metrics.width > maxWidth && currentLine !== '') {
                    if (/[a-zA-Z]/.test(char) && currentLine.includes(' ')) {
                        const lastSpace = currentLine.lastIndexOf(' ');
                        lines.push(currentLine.substring(0, lastSpace));
                        currentLine = currentLine.substring(lastSpace + 1) + char;
                    } else {
                        lines.push(currentLine);
                        currentLine = char;
                    }
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) lines.push(currentLine);
        }
        return lines;
    }

    updateText(text, fontScale) {
        const scale = fontScale || this.lastFontSize;
        if (this.lastText === text && this.lastFontSize === scale) return;
        this.lastText = text;
        this.lastFontSize = scale;

        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        if (text !== "") {
            // 1. Strip HTML tags like <i>, <b>, <u> etc.
            let plainText = text.replace(/<\/?[^>]+(>|$)/g, "");

            // 2. Decode basic HTML entities to show literal characters
            plainText = plainText
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/&nbsp;/g, " ");
            
            const fontSize = Math.round(48 * scale);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top'; 
            
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.fillStyle = 'white';
            
            const maxWidth = w - 160; 
            const lines = this.wrapTextMultiLang(plainText, maxWidth);
            const lineHeight = Math.round(60 * scale);
            
            // Draw lines from top down
            const topMargin = 20;
            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], w / 2, topMargin + (i * lineHeight));
            }

            this.meshL.visible = true;
            this.meshR.visible = !!this.lastIsXR;
        } else {
            this.meshL.visible = this.meshR.visible = false;
        }

        this.texture.needsUpdate = true;
    }

    dispose() {
        this.meshL.geometry.dispose();
        this.texture.dispose();
        this.meshL.material.dispose();
    }
}

export { SubtitleWindow };
