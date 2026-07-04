/**
 * Converts a byte-scaled HSV color (h, s, v each 0-255) into an RGB color (each 0-255).
 */
export const hsvByteToRgb = (h: number, s: number, v: number): { r: number, g: number, b: number } => {
    const hue = (h / 255) * 360;
    const saturation = s / 255;
    const value = v / 255;

    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = value - c;

    let rPrime: number;
    let gPrime: number;
    let bPrime: number;

    if (hue < 60) {
        [rPrime, gPrime, bPrime] = [c, x, 0];
    } else if (hue < 120) {
        [rPrime, gPrime, bPrime] = [x, c, 0];
    } else if (hue < 180) {
        [rPrime, gPrime, bPrime] = [0, c, x];
    } else if (hue < 240) {
        [rPrime, gPrime, bPrime] = [0, x, c];
    } else if (hue < 300) {
        [rPrime, gPrime, bPrime] = [x, 0, c];
    } else {
        [rPrime, gPrime, bPrime] = [c, 0, x];
    }

    return {
        r: Math.round((rPrime + m) * 255),
        g: Math.round((gPrime + m) * 255),
        b: Math.round((bPrime + m) * 255),
    };
};
