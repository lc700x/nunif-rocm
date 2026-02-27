import * as THREE from "three";
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { StereoPlayer } from './stereo_player.js';
import { DebugLog } from './debug_log.js';
import { DEFAULTS } from './constants.js';
import { storage } from './storage.js';

// Suppress "Missing glyph info" warnings from uikit/three-msdf-text-utils
const originalWarn = console.warn;
console.warn = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Missing glyph info')) {
        return;
    }
    originalWarn.apply(console, args);
};

let camera, scene, renderer, stereoPlayer;

init();

async function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 0);

    // Ensure storage is ready before accessing settings
    await storage.ready;

    // Load persistent rendering settings early (Sync)
    const renderSettings = storage.get('render', {});
    const useAntialias = renderSettings.render_antialias ?? DEFAULTS.render_antialias;
    const ssFactor = renderSettings.render_ss ?? DEFAULTS.render_ss;

    renderer = new THREE.WebGLRenderer({ antialias: useAntialias });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    
    // Super Sampling (Scale Factor)
    renderer.xr.setFramebufferScaleFactor(ssFactor);
    
    renderer.localClippingEnabled = true;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    const debugLog = new DebugLog(scene);

    // High quality VR settings
    renderer.xr.addEventListener('sessionstart', () => {
        const session = renderer.xr.getSession();

        // Ensure high quality rendering without foveation artifacts
        renderer.xr.setFoveation(0.0);

        // Frame Rate control
        if (session && session.supportedFrameRates) {
            // Update available frame rates in UI based on hardware capability
            const supported = Array.from(session.supportedFrameRates).sort((a, b) => a - b);
            stereoPlayer.uiManager.availableFrameRates = [0, ...supported];

            // Request target frame rate
            const configFPS = renderSettings.render_fps || 0;
            let targetFPS = 0;

            if (configFPS === 0) {
                // Auto: Find lowest supported rate >= 30fps
                const validRates = supported.filter(r => r >= 30);
                if (validRates.length > 0) targetFPS = validRates[0]; // sorted asc
            } else if (supported.includes(configFPS)) {
                targetFPS = configFPS;
            }

            if (targetFPS > 0 && session.updateTargetFrameRate) {
                session.updateTargetFrameRate(targetFPS).catch(err => {
                    debugLog.log(`[ERROR] Failed to set target frame rate: ${err.message}`);
                });
            }
        }
    });

    stereoPlayer = new StereoPlayer(renderer, camera, scene, debugLog);
    scene.add(stereoPlayer);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
        const delta = clock.getDelta() * 1000; // ms
        stereoPlayer.handleAnimation(delta);
        renderer.render(scene, camera);
    });

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    if (!renderer.xr.isPresenting) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}