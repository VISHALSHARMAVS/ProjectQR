import { useEffect, useState, type CSSProperties } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'projectqr-theme';

export function getStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch {
    // Ignore storage errors in restricted iframes or privacy modes
  }
  return 'system';
}

export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme: Theme): 'light' | 'dark' {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-preference', theme);
    document.documentElement.style.colorScheme = resolved;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', resolved === 'dark' ? '#000000' : '#f8fafc');
    }
  }
  return resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    const stored = getStoredTheme();
    return stored === 'system' ? getSystemTheme() : stored;
  });

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Storage unavailable
    }
    const resolved = applyTheme(newTheme);
    setResolvedTheme(resolved);
  };

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  };

  useEffect(() => {
    // Initial application
    applyTheme(theme);

    // Watch for system OS theme changes when in 'system' mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        if (getStoredTheme() === 'system') {
          const res = applyTheme('system');
          setResolvedTheme(res);
        }
      };
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, [theme]);

  return { theme, resolvedTheme, setTheme, toggleTheme };
}

/**
 * Validates whether a given string is a valid 3 or 6-digit hex color code.
 */
export function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/**
 * Normalizes a hex string to standard 6-digit #RRGGBB format.
 */
export function normalizeHex(hex: string): string {
  let cleaned = hex.trim();
  if (!cleaned.startsWith('#')) cleaned = `#${cleaned}`;
  if (cleaned.length === 4) {
    cleaned = `#${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}${cleaned[3]}${cleaned[3]}`;
  }
  return cleaned.toLowerCase();
}

/**
 * Adjusts brightness of a hex color by a percentage (-100 to 100).
 * Negative values darken, positive values lighten.
 */
export function adjustHexBrightness(hex: string, percent: number): string {
  const norm = normalizeHex(hex);
  const num = parseInt(norm.slice(1), 16);
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));

  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Converts a hex code to an rgba CSS color string with the specified opacity.
 */
export function hexToRgba(hex: string, alpha: number): string {
  const norm = normalizeHex(hex);
  const num = parseInt(norm.slice(1), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

/**
 * Generates dynamic CSS variables for theme customization according to SKILL.md rules.
 * Automatically computes darker hover states and soft translucent surface backgrounds.
 */
export function getBrandStyle(brandColor?: string | null): CSSProperties | undefined {
  if (!brandColor || !isValidHexColor(brandColor)) return undefined;

  const primary = normalizeHex(brandColor);
  const dark = adjustHexBrightness(primary, -18);
  const soft = hexToRgba(primary, 0.12);
  const border = hexToRgba(primary, 0.25);

  return {
    '--green': primary,
    '--green-dark': dark,
    '--soft-green': soft,
    '--brand-primary': primary,
    '--brand-dark': dark,
    '--brand-soft': soft,
    '--brand-border': border
  } as CSSProperties;
}

/**
 * Curated brand color presets compliant with SKILL.md B4 dark background guidelines.
 */
export const BRAND_COLOR_PRESETS = [
  { label: 'Forest Emerald', hex: '#1b4d3e' },
  { label: 'Midnight Cobalt', hex: '#1e3a8a' },
  { label: 'Deep Burgundy', hex: '#881337' },
  { label: 'Warm Terracotta', hex: '#c2410c' },
  { label: 'Golden Amber', hex: '#b45309' },
  { label: 'Royal Violet', hex: '#6b21a8' },
  { label: 'Dark Slate', hex: '#334155' }
];

/**
 * Fast client-side color extraction from an uploaded image file or URL.
 * Samples canvas pixels, filtering out transparent, near-black, near-white,
 * and low-saturation grays to extract the most vibrant brand accent color.
 */
export async function extractDominantColor(fileOrUrl: File | string): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const cleanUp = () => {
      if (typeof fileOrUrl !== 'string') {
        URL.revokeObjectURL(img.src);
      }
    };

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          cleanUp();
          return resolve(null);
        }

        // Downscale to 48x48 for sub-10ms ultra fast client-side sampling
        const width = 48;
        const height = 48;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height).data;

        const colorMap = new Map<string, { count: number; r: number; g: number; b: number; saturation: number }>();

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Filter out transparent pixels
          if (a < 128) continue;

          // Filter out pure white, off-white, and pure black backgrounds
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const lightness = (max + min) / (2 * 255);

          if (lightness > 0.92 || lightness < 0.08) continue;

          // Calculate saturation (0 to 1)
          const saturation = max === 0 ? 0 : delta / max;
          // Filter out washed out grays
          if (saturation < 0.22) continue;

          // Quantize to 16-step bins
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          const existing = colorMap.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            colorMap.set(key, { count: 1, r: qr, g: qg, b: qb, saturation });
          }
        }

        if (colorMap.size === 0) {
          cleanUp();
          return resolve(null);
        }

        // Score buckets by frequency * saturation^1.4 to favor vibrant brand accents
        let bestColor = '';
        let highestScore = -1;

        colorMap.forEach((val) => {
          const score = val.count * Math.pow(val.saturation, 1.4);
          if (score > highestScore) {
            highestScore = score;
            const hexR = Math.min(255, val.r).toString(16).padStart(2, '0');
            const hexG = Math.min(255, val.g).toString(16).padStart(2, '0');
            const hexB = Math.min(255, val.b).toString(16).padStart(2, '0');
            bestColor = `#${hexR}${hexG}${hexB}`;
          }
        });

        cleanUp();
        resolve(bestColor || null);
      } catch {
        cleanUp();
        resolve(null);
      }
    };

    img.onerror = () => {
      cleanUp();
      resolve(null);
    };

    if (typeof fileOrUrl === 'string') {
      img.src = fileOrUrl;
    } else {
      img.src = URL.createObjectURL(fileOrUrl);
    }
  });
}
