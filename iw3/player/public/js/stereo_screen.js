import * as THREE from "three";
import { LIMITS, DEFAULTS, STEREO_FORMATS, UI_CONFIG, VR_CONFIG } from "./constants.js";

// --- Shader Snippets ---

const VERTEX_HEADER = `
    varying vec2 vFadeUv;
    uniform float uCurvature, uWidth;
    uniform vec4 uTiling;
    #ifndef PI
    #define PI 3.141592653589793
    #endif
`;

const VERTEX_UV_PATCH = `
    #include <uv_vertex>
    vFadeUv = uv;
    vMapUv = uv * uTiling.xy + uTiling.zw;
`;

const VERTEX_BEGIN_PATCH = `
    vec3 transformed = vec3( position );
    if ( uCurvature > 0.001 ) {
        float theta = uCurvature * PI;
        float r = uWidth / theta;
        float phi = (position.x / uWidth) * theta;
        transformed.x = r * sin(phi);
        transformed.z = r - r * cos(phi);
    }
`;

const FRAGMENT_HEADER = `
    varying vec2 vFadeUv;
    uniform float uEdgeFade, uWidth, uHeight;
    uniform float uBrightness, uContrast, uGamma, uSaturation, uHue;
    uniform sampler3D uLutMap;
    uniform float uLutEnabled;

    vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
    }

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
`;

const FRAGMENT_MAP_PATCH = `
    #include <map_fragment>

    // 1. Brightness & Contrast (Linear space)
    diffuseColor.rgb *= uBrightness;
    // Adjust contrast around 18% gray pivot
    diffuseColor.rgb = (diffuseColor.rgb - 0.18) * uContrast + 0.18;

    // Processing flags
    bool hasLut = uLutEnabled > 0.5;
    bool hasHue = abs(uHue) > 0.001;
    bool hasSat = abs(uSaturation - 1.0) > 0.01;

    if ( hasLut || hasHue || hasSat ) {
        // A. Convert to sRGB (perceptual space) for LUT and color adjustments
        // We keep values above 1.0 for highlights, but max(0.0) to prevent NaN
        vec3 srgb = pow(max(diffuseColor.rgb, 0.0), vec3(1.0/2.2));

        // B. Apply 3D LUT
        if ( hasLut ) {
            // LUT is defined for 0.0-1.0 range
            srgb = texture(uLutMap, clamp(srgb, 0.0, 1.0)).rgb;
        }

        // C. Hue & Saturation
        if ( hasHue ) {
            vec3 hsv = rgb2hsv(srgb);
            hsv.x = fract(hsv.x + uHue / 360.0);
            srgb = hsv2rgb(hsv);
        }
        if ( hasSat ) {
            // Use Rec.709 luma coefficients for sRGB/HD
            float luma = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
            srgb = mix(vec3(luma), srgb, uSaturation);
        }

        // D. Convert back to Linear space
        diffuseColor.rgb = pow(max(srgb, 0.0), vec3(2.2));
    }

    // 3. Final Gamma adjustment (display output calibration)
    if ( abs(uGamma - 1.0) > 0.001 ) {
        diffuseColor.rgb = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / uGamma));
    }
`;

const FRAGMENT_OPAQUE_PATCH = `
    #include <opaque_fragment>
    if ( uEdgeFade > 0.001 ) {
        float aspect = uHeight / (uWidth * 0.5); 
        float fx = smoothstep(0.0, uEdgeFade * aspect, min(vFadeUv.x, 1.0 - vFadeUv.x) - 0.01);
        float fy = smoothstep(0.0, uEdgeFade, min(vFadeUv.y, 1.0 - vFadeUv.y) - 0.01);
        gl_FragColor.a *= fx * fy;
        if (gl_FragColor.a < 0.001) discard;
    }
`;

class StereoScreen extends THREE.Group {
    constructor(texture, physicalScreenHeight) {
        super();

        this.aspectRatio = 1;
        this.physicalScreenHeight = physicalScreenHeight;
        this.currentStereoFormat = STEREO_FORMATS.SBS_FULL;
        this.currentCurvature = DEFAULTS.screen_curvature;
        this.currentEdgeFade = DEFAULTS.screen_edge_fade;
        this.currentEyeSeparation = DEFAULTS.screen_eye_sep;
        this.currentScreenX = DEFAULTS.screen_tx;
        this.currentScreenY = DEFAULTS.screen_ty;
        this.currentZoom = DEFAULTS.screen_zoom;
        
        this.currentBrightness = DEFAULTS.color_brightness;
        this.currentContrast = DEFAULTS.color_contrast;
        this.currentGamma = DEFAULTS.color_gamma;
        this.currentSaturation = DEFAULTS.color_saturation;
        this.currentHue = DEFAULTS.color_hue;
        this.currentLutEnabled = 0.0;

        const screenWidth = this.aspectRatio;
        const geometry = new THREE.PlaneGeometry(screenWidth, 1.0, VR_CONFIG.screenSegments, 1);

        const blackData = new Uint8Array([0, 0, 0, 255]);
        const blackTex = new THREE.Data3DTexture(blackData, 1, 1, 1);
        blackTex.format = THREE.RGBAFormat;
        blackTex.needsUpdate = true;

        this.uniforms = {
            uCurvature: { value: DEFAULTS.screen_curvature },
            uWidth: { value: screenWidth },
            uHeight: { value: 1.0 },
            uEdgeFade: { value: DEFAULTS.screen_edge_fade },
            uBrightness: { value: DEFAULTS.color_brightness },
            uContrast: { value: DEFAULTS.color_contrast },
            uGamma: { value: DEFAULTS.color_gamma },
            uSaturation: { value: DEFAULTS.color_saturation },
            uHue: { value: DEFAULTS.color_hue },
            uLutMap: { value: blackTex },
            uLutEnabled: { value: 0.0 }
        };

        const createMaterial = (tex, isRight) => {
            const eyeUniforms = {
                uTiling: { value: new THREE.Vector4(0.5, 1, isRight ? 0.5 : 0.0, 0) }
            };
            const mat = new THREE.MeshBasicMaterial({
                map: tex.clone(),
                side: THREE.DoubleSide,
                transparent: true,
            });
            mat.map.colorSpace = tex.colorSpace;
            mat.userData.eyeUniforms = eyeUniforms; 

            mat.onBeforeCompile = (shader) => this._patchShader(shader, eyeUniforms);
            return mat;
        };

        this.displayScreenLeft = new THREE.Mesh(geometry, createMaterial(texture, false));
        this.displayScreenLeft.layers.set(1);
        this.add(this.displayScreenLeft);

        this.displayScreenRight = new THREE.Mesh(geometry, createMaterial(texture, true));
        this.displayScreenRight.layers.set(2);
        this.add(this.displayScreenRight);

        this.lastIsXR = null;

        this.setTranslation(DEFAULTS.screen_tx, DEFAULTS.screen_ty);
        this.setZoom(DEFAULTS.screen_zoom);
    }

    _patchShader(shader, eyeUniforms) {
        Object.assign(shader.uniforms, this.uniforms);
        Object.assign(shader.uniforms, eyeUniforms);

        shader.vertexShader = VERTEX_HEADER + shader.vertexShader
            .replace('#include <uv_vertex>', VERTEX_UV_PATCH)
            .replace('#include <begin_vertex>', VERTEX_BEGIN_PATCH);

        shader.fragmentShader = FRAGMENT_HEADER + shader.fragmentShader
            .replace('#include <map_fragment>', FRAGMENT_MAP_PATCH)
            .replace('#include <opaque_fragment>', FRAGMENT_OPAQUE_PATCH);
    }

    setCurvature(val) {
        this.currentCurvature = THREE.MathUtils.clamp(val, LIMITS.screen_curvatureMin, LIMITS.screen_curvatureMax);
        this.uniforms.uCurvature.value = this.currentCurvature;
    }

    setPhysicalScreenHeight(val) {
        this.physicalScreenHeight = THREE.MathUtils.clamp(val, LIMITS.screen_scaleMin, LIMITS.screen_scaleMax);
        this.displayScreenLeft.scale.set(this.physicalScreenHeight, this.physicalScreenHeight, this.physicalScreenHeight);
        this.displayScreenRight.scale.set(this.physicalScreenHeight, this.physicalScreenHeight, this.physicalScreenHeight);
        this.uniforms.uWidth.value = this.aspectRatio;
        this.uniforms.uHeight.value = 1.0;
    }

    setEdgeFade(val) {
        this.currentEdgeFade = THREE.MathUtils.clamp(val, LIMITS.screen_edge_fadeMin, LIMITS.screen_edge_fadeMax);
        this.uniforms.uEdgeFade.value = this.currentEdgeFade;
    }

    setBrightness(val) {
        this.currentBrightness = THREE.MathUtils.clamp(val, LIMITS.color_brightnessMin, LIMITS.color_brightnessMax);
        this.uniforms.uBrightness.value = this.currentBrightness;
    }

    setContrast(val) {
        this.currentContrast = THREE.MathUtils.clamp(val, LIMITS.color_contrastMin, LIMITS.color_contrastMax);
        this.uniforms.uContrast.value = this.currentContrast;
    }

    setGamma(val) {
        this.currentGamma = THREE.MathUtils.clamp(val, LIMITS.color_gammaMin, LIMITS.color_gammaMax);
        this.uniforms.uGamma.value = this.currentGamma;
    }

    setSaturation(val) {
        this.currentSaturation = THREE.MathUtils.clamp(val, LIMITS.color_saturationMin, LIMITS.color_saturationMax);
        this.uniforms.uSaturation.value = this.currentSaturation;
    }

    setLutTexture(texture) {
        if (this.uniforms.uLutMap.value && this.uniforms.uLutMap.value instanceof THREE.Texture && this.uniforms.uLutMap.value.image && (this.uniforms.uLutMap.value.image.width > 1 || this.uniforms.uLutMap.value.image.depth > 1)) {
            this.uniforms.uLutMap.value.dispose();
        }
        if (texture) {
            this.uniforms.uLutMap.value = texture;
            this.uniforms.uLutEnabled.value = 1.0;
        } else {
            const blackData = new Uint8Array([0, 0, 0, 255]);
            const blackTex = new THREE.Data3DTexture(blackData, 1, 1, 1);
            blackTex.format = THREE.RGBAFormat;
            blackTex.needsUpdate = true;
            this.uniforms.uLutMap.value = blackTex;
            this.uniforms.uLutEnabled.value = 0.0;
        }
    }

    setHue(val) {
        this.currentHue = THREE.MathUtils.clamp(val, LIMITS.color_hueMin, LIMITS.color_hueMax);
        this.uniforms.uHue.value = this.currentHue;
    }

    updateEyeVisibility(isXR) {
        if (isXR !== this.lastIsXR) {
            if (isXR) {
                // In XR, screens are rendered by Layer 1/2. Disable Layer 0.
                this.displayScreenLeft.layers.disable(0);
                this.displayScreenRight.layers.disable(0);
                // Only show right eye if left eye is currently active (media loaded)
                this.displayScreenRight.visible = this.displayScreenLeft.visible;
            } else {
                // In PC (non-XR), show only the left eye screen on Layer 0.
                this.displayScreenLeft.layers.enable(0);
                this.displayScreenRight.layers.disable(0);
                this.displayScreenRight.visible = false;
            }
            this.lastIsXR = isXR;
        }
    }

    slideEyeSeparation(direction, delta = 16) {
        const maxSep = LIMITS.screen_eye_sepMax;
        const ratio = Math.abs(this.currentEyeSeparation) / maxSep;
        const baseSens = (UI_CONFIG.eyeSeparationSensitivity * (1.0 - ratio) + UI_CONFIG.eyeSeparationSensitivityMin) * (delta / 1000);
        return this.setEyeSeparation(this.currentEyeSeparation + direction * baseSens);
    }

    setEyeSeparation(sep) {
        const next = THREE.MathUtils.clamp(sep, LIMITS.screen_eye_sepMin, LIMITS.screen_eye_sepMax);
        const changed = next !== this.currentEyeSeparation;
        this.currentEyeSeparation = next;
        this.updatePositions();
        return changed;
    }

    zoomScreen(direction, delta = 16) {
        const rootPos = this.getWorldPosition(new THREE.Vector3());
        const currentPos = this.localToWorld(new THREE.Vector3(0, 0, this.currentZoom));
        const currentDist = rootPos.distanceTo(currentPos);
        const sensitivity = (currentDist * 0.9) * (delta / 1000);
        return this.setZoom(this.currentZoom + sensitivity * direction);
    }

    setZoom(z) {
        const rootPos = this.getWorldPosition(new THREE.Vector3());
        const newPos = this.localToWorld(new THREE.Vector3(0, 0, z));
        const dist = rootPos.distanceTo(newPos);
        if (dist >= LIMITS.screen_zoomMin && dist <= LIMITS.screen_zoomMax) {
            this.currentZoom = z;
            this.displayScreenLeft.position.z = this.displayScreenRight.position.z = z;
            return true;
        }
        return false;
    }

    translateScreen(dx, dy) { this.setTranslation(this.currentScreenX + dx, this.currentScreenY + dy); }
    setTranslation(x, y) {
        const xLimit = LIMITS.screen_txMax * this.physicalScreenHeight * this.aspectRatio;
        const yLimit = LIMITS.screen_tyMax * this.physicalScreenHeight;
        this.currentScreenX = THREE.MathUtils.clamp(x, -xLimit, xLimit);
        this.currentScreenY = THREE.MathUtils.clamp(y, -yLimit, yLimit);
        this.updatePositions();
    }

    updatePositions() {
        this.displayScreenLeft.position.x = this.currentScreenX - this.currentEyeSeparation / 2;
        this.displayScreenRight.position.x = this.currentScreenX + this.currentEyeSeparation / 2;
        this.displayScreenLeft.position.y = this.displayScreenRight.position.y = this.currentScreenY;
    }

    updateTexture(texture, totalAspectRatio, format = STEREO_FORMATS.SBS_FULL) {
        this.currentStereoFormat = format;
        this.displayScreenLeft.visible = true;
        this.displayScreenRight.visible = !!this.lastIsXR;
        let displayAspectRatio = totalAspectRatio;
        let repeatX = 0.5, repeatY = 1.0;
        let leftOffset = new THREE.Vector2(0, 0), rightOffset = new THREE.Vector2(0.5, 0);

        if (format === STEREO_FORMATS.SBS_FULL) { displayAspectRatio = totalAspectRatio / 2.0; } 
        else if (format === STEREO_FORMATS.SBS_HALF) { displayAspectRatio = totalAspectRatio; } 
        else if (format === STEREO_FORMATS.SBS_FULL_CROSS) { displayAspectRatio = totalAspectRatio / 2.0; leftOffset.set(0.5, 0); rightOffset.set(0, 0); } 
        else if (format === STEREO_FORMATS.TB_FULL) { displayAspectRatio = totalAspectRatio * 2.0; repeatX = 1.0; repeatY = 0.5; leftOffset.set(0, 0.5); rightOffset.set(0, 0); } 
        else if (format === STEREO_FORMATS.TB_HALF) { displayAspectRatio = totalAspectRatio; repeatX = 1.0; repeatY = 0.5; leftOffset.set(0, 0.5); rightOffset.set(0, 0); } 
        else if (format === STEREO_FORMATS.FLAT) { displayAspectRatio = totalAspectRatio; repeatX = 1.0; repeatY = 1.0; leftOffset.set(0, 0); rightOffset.set(0, 0); }

        this.aspectRatio = displayAspectRatio;
        const screenWidth = this.aspectRatio; 
        const newGeo = new THREE.PlaneGeometry(screenWidth, 1.0, VR_CONFIG.screenSegments, 1); 
        this.uniforms.uWidth.value = screenWidth;
        this.uniforms.uHeight.value = 1.0;

        // Dispose old geometry once (since it's shared)
        if (this.displayScreenLeft.geometry) {
            this.displayScreenLeft.geometry.dispose();
        }

        const oldTexture = this.displayScreenLeft.material.map;
        if (oldTexture && oldTexture !== texture) {
            oldTexture.dispose();
        }

        [this.displayScreenLeft, this.displayScreenRight].forEach((m, i) => {
            const isRight = (i === 1);
            m.geometry = newGeo;
            m.material.map = texture;
            const off = isRight ? rightOffset : leftOffset;
            m.material.userData.eyeUniforms.uTiling.value.set(repeatX, repeatY, off.x, off.y);
            m.material.needsUpdate = true;
        });
        this.updatePositions();
    }

    clearScreen() {
        const blackData = new Uint8Array([0, 0, 0, 255]);
        const blackTex = new THREE.DataTexture(blackData, 1, 1, THREE.RGBAFormat);
        blackTex.needsUpdate = true;
        this.updateTexture(blackTex, 1.0);
        this.displayScreenLeft.visible = this.displayScreenRight.visible = false;
    }
}

export { StereoScreen };
