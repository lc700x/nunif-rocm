import * as THREE from "three";


class DebugLog {
    constructor(scene, maxLogLines = 10) {
        this.scene = scene;
        this.maxLogLines = maxLogLines;
        this._debugLog = [];

        this.canvasWidth = 512;
        this.canvasHeight = this.maxLogLines * 20;

        this.debugCanvas = document.createElement('canvas');
        this.debugCanvas.width = this.canvasWidth;
        this.debugCanvas.height = this.canvasHeight;
        this.debugContext = this.debugCanvas.getContext('2d');

        this.debugTexture = new THREE.CanvasTexture(this.debugCanvas);
        const debugMaterial = new THREE.SpriteMaterial({ map: this.debugTexture });
        this.debugSprite = new THREE.Sprite(debugMaterial);

        this.debugSprite.scale.set(this.canvasWidth / 200, this.canvasHeight / 200, 1);
        this.debugSprite.position.set(0, 1.0, -2);

        this.debugSprite.visible = true;
        this.scene.add(this.debugSprite);
        this.update();
    }

    setVisible(val) {
        this.debugSprite.visible = !!val;
    }

    log(s) {
        console.log(s);
        this._debugLog.push(s);
        this.update();
    }

    update() {
        if (!this.debugContext) return;

        this.debugContext.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        this.debugContext.font = '16px Arial';
        this.debugContext.fillStyle = 'white';
        this.debugContext.textAlign = 'left';
        this.debugContext.textBaseline = 'top';

        const startIndex = Math.max(0, this._debugLog.length - this.maxLogLines);
        for (let i = 0; i < this.maxLogLines; i++) {
            if (startIndex + i < this._debugLog.length) {
                this.debugContext.fillText(this._debugLog[startIndex + i], 5, 5 + (i * 20));
            }
        }
        this.debugTexture.needsUpdate = true;
    }
}

export { DebugLog };
