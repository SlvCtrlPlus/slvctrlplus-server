import { BYTE_MAX } from './numbers.js';

/**
 * Converts a byte-scaled HSV color (h, s, v each 0-255) into an RGB color (each 0-255).
 */
const HUE_CIRCLE_DEGREES = 360;
const HUE_SECTOR_DEGREES = 60;
const HUE_MODULO_DIVISOR = 2;
const HUE_SECTOR_1_END = 60;
const HUE_SECTOR_2_END = 120;
const HUE_SECTOR_3_END = 180;
const HUE_SECTOR_4_END = 240;
const HUE_SECTOR_5_END = 300;

export const hsvByteToRgb = (h: number, s: number, v: number): { r: number, g: number, b: number } => {
    const hue = (h / BYTE_MAX) * HUE_CIRCLE_DEGREES;
    const saturation = s / BYTE_MAX;
    const value = v / BYTE_MAX;

    const c = value * saturation;
    const x = c * (1 - Math.abs(((hue / HUE_SECTOR_DEGREES) % HUE_MODULO_DIVISOR) - 1));
    const m = value - c;

    let rPrime: number;
    let gPrime: number;
    let bPrime: number;

    if (hue < HUE_SECTOR_1_END) {
        [rPrime, gPrime, bPrime] = [c, x, 0];
    } else if (hue < HUE_SECTOR_2_END) {
        [rPrime, gPrime, bPrime] = [x, c, 0];
    } else if (hue < HUE_SECTOR_3_END) {
        [rPrime, gPrime, bPrime] = [0, c, x];
    } else if (hue < HUE_SECTOR_4_END) {
        [rPrime, gPrime, bPrime] = [0, x, c];
    } else if (hue < HUE_SECTOR_5_END) {
        [rPrime, gPrime, bPrime] = [x, 0, c];
    } else {
        [rPrime, gPrime, bPrime] = [c, 0, x];
    }

    return {
        r: Math.round((rPrime + m) * BYTE_MAX),
        g: Math.round((gPrime + m) * BYTE_MAX),
        b: Math.round((bPrime + m) * BYTE_MAX),
    };
};
