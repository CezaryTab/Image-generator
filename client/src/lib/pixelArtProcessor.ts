// Fixed 8-color palette
export const PALETTE = [
  { hex: 'FA181C', r: 250, g: 24, b: 28, name: 'Red' },
  { hex: 'FD8305', r: 253, g: 131, b: 5, name: 'Orange' },
  { hex: 'FDE91A', r: 253, g: 233, b: 26, name: 'Yellow' },
  { hex: '49CB05', r: 73, g: 203, b: 5, name: 'Green' },
  { hex: '39B1DB', r: 57, g: 177, b: 219, name: 'Cyan' },
  { hex: '4432D4', r: 68, g: 50, b: 212, name: 'Blue' },
  { hex: '7F20CA', r: 127, g: 32, b: 202, name: 'Purple' },
  { hex: 'DB45D0', r: 219, g: 69, b: 208, name: 'Pink' },
] as const;

export type PaletteColor = typeof PALETTE[number];

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
  paletteUsage: Map<string, number>;
}

export interface ProcessedResult {
  imageData: ImageData;
  stats: ProcessingStats;
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

// Find nearest palette color
function findNearestPaletteColor(r: number, g: number, b: number, allowedColors: PaletteColor[]): { color: PaletteColor; distance: number } {
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

// Center crop and scale image to 36x36
export function preprocessImage(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 36;
  const ctx = canvas.getContext('2d')!;
  
  // Calculate center crop
  const size = Math.min(image.width, image.height);
  const sx = (image.width - size) / 2;
  const sy = (image.height - size) / 2;
  
  // Disable smoothing for crisp pixels
  ctx.imageSmoothingEnabled = false;
  
  // Draw cropped and scaled image
  ctx.drawImage(image, sx, sy, size, size, 0, 0, 36, 36);
  
  return ctx.getImageData(0, 0, 36, 36);
}

// Main processing function
export function processPixelArt(
  sourceData: ImageData,
  options: ProcessingOptions
): ProcessedResult {
  const { data } = sourceData;
  const width = 36;
  const height = 36;
  
  // Create output buffer
  const output = new Uint8ClampedArray(data.length);
  
  // Determine which palette colors are allowed based on maxColorsUsed
  // First pass: count frequency of each palette color
  const colorFrequency = new Map<string, number>();
  PALETTE.forEach(c => colorFrequency.set(c.hex, 0));
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    if (a < 128) continue;
    
    const { color } = findNearestPaletteColor(r, g, b, [...PALETTE]);
    colorFrequency.set(color.hex, (colorFrequency.get(color.hex) || 0) + 1);
  }
  
  // Sort and get top N colors
  const sortedColors = [...colorFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.maxColorsUsed)
    .map(([hex]) => PALETTE.find(c => c.hex === hex)!);
  
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
    
    const { color: nearestColor, distance } = findNearestPaletteColor(r, g, b, sortedColors);
    
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
  
  // Calculate final stats
  const paletteUsage = new Map<string, number>();
  PALETTE.forEach(c => paletteUsage.set(c.hex, 0));
  
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
    
    let isPalette = false;
    for (const color of PALETTE) {
      if (color.r === r && color.g === g && color.b === b) {
        paletteUsage.set(color.hex, (paletteUsage.get(color.hex) || 0) + 1);
        isPalette = true;
        break;
      }
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
  canvas.width = 36 * scale;
  canvas.height = 36 * scale;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  // Create temporary canvas for source
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 36;
  tempCanvas.height = 36;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
  // Draw scaled up
  ctx.drawImage(tempCanvas, 0, 0, 36, 36, 0, 0, canvas.width, canvas.height);
}

// Export as PNG
export function exportAsPng(imageData: ImageData): void {
  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 36;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  
  const link = document.createElement('a');
  link.download = 'pixel-art-36x36.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}
