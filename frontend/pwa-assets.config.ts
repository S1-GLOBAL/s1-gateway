import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * PWA icons from public/brand/app-icon.png, written beside it.
 * The source is already full-bleed near-black with the mark inside the
 * maskable safe zone, so no icon gets extra padding or a white background.
 * Run `npm run pwa:icons` after changing the source.
 */
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#0b0c0b' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#0b0c0b' } },
  },
  images: ['public/brand/app-icon.png'],
});
