// Drandee Filter Engine
// Converts our adjustment states into CSS filter strings

export const PRESET_FILTERS = {
  Original: { brightness: 100, contrast: 100, saturation: 100, sepia: 0, hue: 0 },
  Cinematic: { brightness: 90, contrast: 120, saturation: 80, sepia: 10, hue: 0 },
  Warm: { brightness: 105, contrast: 105, saturation: 110, sepia: 20, hue: 0 },
  Cool: { brightness: 100, contrast: 110, saturation: 90, sepia: 0, hue: 180 },
  Vintage: { brightness: 90, contrast: 80, saturation: 60, sepia: 40, hue: 0 },
  Mono: { brightness: 100, contrast: 120, saturation: 0, sepia: 0, hue: 0 },
  Dream: { brightness: 110, contrast: 90, saturation: 120, sepia: 0, hue: 0 },
  Night: { brightness: 120, contrast: 110, saturation: 100, sepia: 0, hue: 200 },
  Soft: { brightness: 105, contrast: 90, saturation: 90, sepia: 0, hue: 0 }
};

export const getCssFilterString = (filterName, adjustments) => {
  // Base preset
  const preset = PRESET_FILTERS[filterName] || PRESET_FILTERS.Original;
  
  // Combine preset with manual adjustments
  // Adjustments map: brightness (0-200), contrast (0-200), saturation (0-200), exposure (fake via brightness), temperature (fake via sepia/hue)
  
  const b = preset.brightness * (adjustments?.brightness !== undefined ? adjustments.brightness / 100 : 1);
  const c = preset.contrast * (adjustments?.contrast !== undefined ? adjustments.contrast / 100 : 1);
  const s = preset.saturation * (adjustments?.saturation !== undefined ? adjustments.saturation / 100 : 1);
  
  // Fake exposure with extra brightness multiplier
  const exp = adjustments?.exposure !== undefined ? adjustments.exposure / 100 : 1;
  const finalBrightness = b * exp;
  
  return `brightness(${finalBrightness}%) contrast(${c}%) saturate(${s}%) sepia(${preset.sepia}%) hue-rotate(${preset.hue}deg)`;
};
