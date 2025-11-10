globalThis.__SANDGRAAL_DISABLE_BOOTSTRAP__ = true;

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function () {
    return {
      clearRect() {},
      beginPath() {},
      moveTo() {},
      lineTo() {},
      stroke() {},
      fill() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
      scale() {},
      setTransform() {},
      closePath() {},
    };
  };
}
