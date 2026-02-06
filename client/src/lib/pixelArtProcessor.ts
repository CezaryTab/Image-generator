// Fixed 9-color palette with 1 lighter shade and 2 darker shades each
export const PALETTE_GROUPS = [
  {
    name: 'Red',
    colors: [
      { hex: 'FC8B8D', r: 252, g: 139, b: 141, shade: 'light' },
      { hex: 'FA181C', r: 250, g: 24, b: 28, shade: 'main' },
      { hex: 'B31114', r: 179, g: 17, b: 20, shade: 'dark' },
      { hex: '7F0A0C', r: 127, g: 10, b: 12, shade: 'darker' },
    ],
  },
  {
    name: 'Orange',
    colors: [
      { hex: 'FEC182', r: 254, g: 193, b: 130, shade: 'light' },
      { hex: 'FD8305', r: 253, g: 131, b: 5, shade: 'main' },
      { hex: 'B55E04', r: 181, g: 94, b: 4, shade: 'dark' },
      { hex: '804203', r: 128, g: 66, b: 3, shade: 'darker' },
    ],
  },
  {
    name: 'Yellow',
    colors: [
      { hex: 'FEF48C', r: 254, g: 244, b: 140, shade: 'light' },
      { hex: 'FDE91A', r: 253, g: 233, b: 26, shade: 'main' },
      { hex: 'B5A713', r: 181, g: 167, b: 19, shade: 'dark' },
      { hex: '80760D', r: 128, g: 118, b: 13, shade: 'darker' },
    ],
  },
  {
    name: 'Green',
    colors: [
      { hex: 'A4E582', r: 164, g: 229, b: 130, shade: 'light' },
      { hex: '49CB05', r: 73, g: 203, b: 5, shade: 'main' },
      { hex: '349104', r: 52, g: 145, b: 4, shade: 'dark' },
      { hex: '256603', r: 37, g: 102, b: 3, shade: 'darker' },
    ],
  },
  {
    name: 'Cyan',
    colors: [
      { hex: '9CD8ED', r: 156, g: 216, b: 237, shade: 'light' },
      { hex: '39B1DB', r: 57, g: 177, b: 219, shade: 'main' },
      { hex: '297F9D', r: 41, g: 127, b: 157, shade: 'dark' },
      { hex: '1D596F', r: 29, g: 89, b: 111, shade: 'darker' },
    ],
  },
  {
    name: 'Blue',
    colors: [
      { hex: 'A198E9', r: 161, g: 152, b: 233, shade: 'light' },
      { hex: '4432D4', r: 68, g: 50, b: 212, shade: 'main' },
      { hex: '312498', r: 49, g: 36, b: 152, shade: 'dark' },
      { hex: '23196B', r: 35, g: 25, b: 107, shade: 'darker' },
    ],
  },
  {
    name: 'Purple',
    colors: [
      { hex: 'BF8FE4', r: 191, g: 143, b: 228, shade: 'light' },
      { hex: '7F20CA', r: 127, g: 32, b: 202, shade: 'main' },
      { hex: '5B1791', r: 91, g: 23, b: 145, shade: 'dark' },
      { hex: '401066', r: 64, g: 16, b: 102, shade: 'darker' },
    ],
  },
  {
    name: 'Pink',
    colors: [
      { hex: 'EDA2E7', r: 237, g: 162, b: 231, shade: 'light' },
      { hex: 'DB45D0', r: 219, g: 69, b: 208, shade: 'main' },
      { hex: '9D3195', r: 157, g: 49, b: 149, shade: 'dark' },
      { hex: '6F2369', r: 111, g: 35, b: 105, shade: 'darker' },
    ],
  },
  {
    name: 'Gray',
    colors: [
      { hex: 'D7D7D7', r: 215, g: 215, b: 215, shade: 'light' },
      { hex: 'AFAFAF', r: 175, g: 175, b: 175, shade: 'main' },
      { hex: '949494', r: 148, g: 148, b: 148, shade: 'dark' },
      { hex: '605F5F', r: 96, g: 95, b: 95, shade: 'darker' },
    ],
  },
] as const;

export type PaletteGroup = typeof PALETTE_GROUPS[number];
export type PaletteColor = PaletteGroup['colors'][number] & { groupName: string };

// Flatten palette for color matching
export function getAllPaletteColors(): PaletteColor[] {
  const colors: PaletteColor[] = [];
  for (const group of PALETTE_GROUPS) {
    for (const color of group.colors) {
      colors.push({ ...color, groupName: group.name });
    }
  }
  return colors;
}

// Get main colors only (for max colors limiting)
export function getMainPaletteColors(): PaletteColor[] {
  return PALETTE_GROUPS.map(group => ({
    ...group.colors[0],
    groupName: group.name,
  }));
}

export interface ProcessingOptions {
  fallbackMode: 'transparent' | 'fallback';
  fallbackCapPercent: number;
  closenessThreshold: number;
  maxColorsUsed: number;
  symmetryMode: 'none' | 'vertical' | 'horizontal';
  detailLevel: number;
}

export interface ProcessingStats {
  fallbackPercent: number;
  transparentPixels: number;
  paletteUsage: Map<string, number>; // Group name -> count
}

export interface ProcessedResult {
  imageData: ImageData;
  stats: ProcessingStats;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate RGB distance between two colors
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

// Calculate luminance for brightness check
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Find nearest palette color from allowed colors
function findNearestPaletteColor(
  r: number, g: number, b: number,
  allowedColors: PaletteColor[]
): { color: PaletteColor; distance: number } {
  let minDist = Infinity;
  let nearest = allowedColors[0];
  
  for (const color of allowedColors) {
    const dist = colorDistance(r, g, b, color.r, color.g, color.b);
    if (dist < minDist) {
      minDist = dist;
      nearest = color;
    }
  }
  
  return { color: nearest, distance: minDist };
}

// Crop and scale image to specified output dimensions (can be rectangular)
export function preprocessImage(
  image: HTMLImageElement,
  outputWidth: number,
  outputHeight: number,
  cropRegion?: CropRegion
): ImageData {
  const width = Math.max(1, Math.round(outputWidth));
  const height = Math.max(1, Math.round(outputHeight));
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  let sx: number, sy: number, sWidth: number, sHeight: number;
  
  if (cropRegion) {
    // Use custom crop region - round to integers for Canvas API
    sx = Math.round(cropRegion.x);
    sy = Math.round(cropRegion.y);
    sWidth = Math.round(cropRegion.width);
    sHeight = Math.round(cropRegion.height);
  } else {
    // Default: use full image
    sx = 0;
    sy = 0;
    sWidth = image.width;
    sHeight = image.height;
  }
  
  // Disable smoothing for crisp pixels (Nearest Neighbor)
  ctx.imageSmoothingEnabled = false;
  
  // Draw cropped and scaled image
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, width, height);
  
  return ctx.getImageData(0, 0, width, height);
}

// Get default crop for an image (uses full image dimensions)
export function getDefaultCrop(imageWidth: number, imageHeight: number): CropRegion {
  return {
    x: 0,
    y: 0,
    width: imageWidth,
    height: imageHeight,
  };
}

// Main processing function
export function processPixelArt(
  sourceData: ImageData,
  options: ProcessingOptions
): ProcessedResult {
  const { data, width, height } = sourceData;
  
  // Create output buffer
  const output = new Uint8ClampedArray(data.length);
  
  // Get all colors with shades
  const allColors = getAllPaletteColors();
  
  // Determine which color groups are allowed based on maxColorsUsed
  // First pass: count frequency of each color group
  const groupFrequency = new Map<string, number>();
  PALETTE_GROUPS.forEach(g => groupFrequency.set(g.name, 0));
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a < 128) continue;
    
    const { color } = findNearestPaletteColor(r, g, b, allColors);
    groupFrequency.set(color.groupName, (groupFrequency.get(color.groupName) || 0) + 1);
  }
  
  // Sort and get top N color groups
  const allowedGroups = Array.from(groupFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.maxColorsUsed)
    .map(([name]) => name);
  
  // Filter allowed colors to only those in allowed groups
  const allowedColors = allColors.filter(c => allowedGroups.includes(c.groupName));
  
  // Threshold for "close enough" (max RGB distance is sqrt(3 * 255^2) ≈ 441)
  const threshold = options.closenessThreshold * 441;
  
  // Track fallback pixels
  type PixelInfo = {
    index: number;
    isFallback: boolean;
    originalR: number;
    originalG: number;
    originalB: number;
    nearestColor: PaletteColor;
    distance: number;
  };
  
  const pixelInfos: PixelInfo[] = [];
  
  // First pass: assign colors
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Handle transparent pixels
    if (a < 128) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;
      continue;
    }
    
    const { color: nearestColor, distance } = findNearestPaletteColor(r, g, b, allowedColors);
    
    // Check if close enough
    const isCloseEnough = distance <= threshold;
    
    if (isCloseEnough) {
      output[i] = nearestColor.r;
      output[i + 1] = nearestColor.g;
      output[i + 2] = nearestColor.b;
      output[i + 3] = 255;
      pixelInfos.push({
        index: i,
        isFallback: false,
        originalR: r,
        originalG: g,
        originalB: b,
        nearestColor,
        distance
      });
    } else {
      // Handle fallback
      if (options.fallbackMode === 'transparent') {
        output[i] = 0;
        output[i + 1] = 0;
        output[i + 2] = 0;
        output[i + 3] = 0;
      } else {
        // Check brightness
        const luminance = getLuminance(r, g, b);
        if (luminance < 30) {
          // Too dark, use nearest palette color
          output[i] = nearestColor.r;
          output[i + 1] = nearestColor.g;
          output[i + 2] = nearestColor.b;
          output[i + 3] = 255;
          pixelInfos.push({
            index: i,
            isFallback: false,
            originalR: r,
            originalG: g,
            originalB: b,
            nearestColor,
            distance
          });
        } else {
          // Keep as fallback
          output[i] = r;
          output[i + 1] = g;
          output[i + 2] = b;
          output[i + 3] = 255;
          pixelInfos.push({
            index: i,
            isFallback: true,
            originalR: r,
            originalG: g,
            originalB: b,
            nearestColor,
            distance
          });
        }
      }
    }
  }
  
  // Enforce fallback cap
  const totalOpaquePixels = pixelInfos.length;
  const fallbackPixels = pixelInfos.filter(p => p.isFallback);
  const maxFallback = Math.floor(totalOpaquePixels * (options.fallbackCapPercent / 100));
  
  if (fallbackPixels.length > maxFallback) {
    // Sort by distance (least important = closest to palette = easiest to convert)
    fallbackPixels.sort((a, b) => a.distance - b.distance);
    
    // Convert excess fallback to palette
    for (let i = 0; i < fallbackPixels.length - maxFallback; i++) {
      const p = fallbackPixels[i];
      output[p.index] = p.nearestColor.r;
      output[p.index + 1] = p.nearestColor.g;
      output[p.index + 2] = p.nearestColor.b;
      p.isFallback = false;
    }
  }
  
  // Apply refinement passes based on detail level
  const refinementPasses = Math.max(0, 3 - Math.floor(options.detailLevel * 3));
  
  for (let pass = 0; pass < refinementPasses; pass++) {
    // Noise cleanup - remove isolated pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (output[i + 3] === 0) continue;
        
        // Count neighbors with same color
        const neighbors: { r: number; g: number; b: number; count: number }[] = [];
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            
            const ni = (ny * width + nx) * 4;
            if (output[ni + 3] === 0) continue;
            
            const nr = output[ni];
            const ng = output[ni + 1];
            const nb = output[ni + 2];
            
            let found = false;
            for (const n of neighbors) {
              if (n.r === nr && n.g === ng && n.b === nb) {
                n.count++;
                found = true;
                break;
              }
            }
            if (!found) {
              neighbors.push({ r: nr, g: ng, b: nb, count: 1 });
            }
          }
        }
        
        // If current pixel is isolated (no matching neighbors), replace with majority
        const currentR = output[i];
        const currentG = output[i + 1];
        const currentB = output[i + 2];
        
        const hasMatch = neighbors.some(n => n.r === currentR && n.g === currentG && n.b === currentB);
        
        if (!hasMatch && neighbors.length > 0) {
          neighbors.sort((a, b) => b.count - a.count);
          output[i] = neighbors[0].r;
          output[i + 1] = neighbors[0].g;
          output[i + 2] = neighbors[0].b;
        }
      }
    }
  }
  
  // Apply symmetry
  if (options.symmetryMode === 'vertical') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width / 2; x++) {
        const leftI = (y * width + x) * 4;
        const rightI = (y * width + (width - 1 - x)) * 4;
        
        // Use left side as source
        output[rightI] = output[leftI];
        output[rightI + 1] = output[leftI + 1];
        output[rightI + 2] = output[leftI + 2];
        output[rightI + 3] = output[leftI + 3];
      }
    }
  } else if (options.symmetryMode === 'horizontal') {
    for (let y = 0; y < height / 2; y++) {
      for (let x = 0; x < width; x++) {
        const topI = (y * width + x) * 4;
        const bottomI = ((height - 1 - y) * width + x) * 4;
        
        // Use top side as source
        output[bottomI] = output[topI];
        output[bottomI + 1] = output[topI + 1];
        output[bottomI + 2] = output[topI + 2];
        output[bottomI + 3] = output[topI + 3];
      }
    }
  }
  
  // Calculate final stats - group by color group name
  const paletteUsage = new Map<string, number>();
  PALETTE_GROUPS.forEach(g => paletteUsage.set(g.name, 0));
  
  let transparentCount = 0;
  let fallbackCount = 0;
  let opaqueCount = 0;
  
  for (let i = 0; i < output.length; i += 4) {
    if (output[i + 3] === 0) {
      transparentCount++;
      continue;
    }
    
    opaqueCount++;
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    
    // Find which group this color belongs to
    let isPalette = false;
    for (const group of PALETTE_GROUPS) {
      for (const color of group.colors) {
        if (color.r === r && color.g === g && color.b === b) {
          paletteUsage.set(group.name, (paletteUsage.get(group.name) || 0) + 1);
          isPalette = true;
          break;
        }
      }
      if (isPalette) break;
    }
    
    if (!isPalette) {
      fallbackCount++;
    }
  }
  
  return {
    imageData: new ImageData(output, width, height),
    stats: {
      fallbackPercent: opaqueCount > 0 ? (fallbackCount / opaqueCount) * 100 : 0,
      transparentPixels: transparentCount,
      paletteUsage
    }
  };
}

// Draw processed image to canvas
export function drawToCanvas(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  scale: number = 8
): void {
  const { width, height } = imageData;
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  // Create temporary canvas for source
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
  // Draw scaled up
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
}

// Export as PNG
export function exportAsPng(imageData: ImageData): void {
  const { width, height } = imageData;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  
  const link = document.createElement('a');
  link.download = `pixel-art-${width}x${height}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// Unity-compatible JSON export format
export interface PixelData {
  colorGroup: string;
  shadeIndex: number;
  hex: string;
}

export interface UnityExportFormat {
  version: string;
  width: number;
  height: number;
  palette: {
    name: string;
    colors: { hex: string; shade: string }[];
  }[];
  pixels: (PixelData | null)[][];
}

// Export as JSON for Unity
export function exportAsJson(imageData: ImageData, fileName?: string): void {
  const { data, width, height } = imageData;
  const pixels: (PixelData | null)[][] = [];
  
  for (let y = 0; y < height; y++) {
    const row: (PixelData | null)[] = [];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a === 0) {
        row.push(null);
        continue;
      }
      
      let found = false;
      for (const group of PALETTE_GROUPS) {
        for (let shadeIdx = 0; shadeIdx < group.colors.length; shadeIdx++) {
          const color = group.colors[shadeIdx];
          if (color.r === r && color.g === g && color.b === b) {
            row.push({
              colorGroup: group.name,
              shadeIndex: shadeIdx,
              hex: color.hex
            });
            found = true;
            break;
          }
        }
        if (found) break;
      }
      
      if (!found) {
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
        row.push({
          colorGroup: 'Fallback',
          shadeIndex: 0,
          hex: hex
        });
      }
    }
    pixels.push(row);
  }
  
  const exportData: UnityExportFormat = {
    version: '1.0',
    width: width,
    height: height,
    palette: PALETTE_GROUPS.map(group => ({
      name: group.name,
      colors: group.colors.map(c => ({
        hex: c.hex,
        shade: c.shade
      }))
    })),
    pixels: pixels
  };
  
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = fileName ? `${fileName}.json` : `pixel-art-${width}x${height}.json`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
}
