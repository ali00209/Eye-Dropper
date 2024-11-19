class ColorUtils {
  static rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  static rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  static hexToHsl(hex) {
    const rgb = this.hexToRgb(hex);
    return rgb ? this.rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  }

  static formatColor(color, format) {
    if (!color) return '';

    switch (format) {
      case 'hex':
        return typeof color === 'string' ? color.toUpperCase() : this.rgbToHex(color.r, color.g, color.b);
      case 'rgb':
        const rgb = typeof color === 'string' ? this.hexToRgb(color) : color;
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      case 'hsl':
        const hsl = typeof color === 'string' ? this.hexToHsl(color) : this.rgbToHsl(color.r, color.g, color.b);
        return `hsl(${hsl.h}°, ${hsl.s}%, ${hsl.l}%)`;
      default:
        return '';
    }
  }

  static getAllFormats(color) {
    return {
      hex: this.formatColor(color, 'hex'),
      rgb: this.formatColor(color, 'rgb'),
      hsl: this.formatColor(color, 'hsl')
    };
  }
}
