// Fixed 8-color palette with 2 darker shades each
export const PALETTE_GROUPS = [
  {
    name: 'Red',
    colors: [
      { hex: 'FA181C', r: 250, g: 24, b: 28, shade: 'main' },
      { hex: 'B31114', r: 179, g: 17, b: 20, shade: 'dark' },
      { hex: '7F0A0C', r: 127, g: 10, b: 12, shade: 'darker' },
    ],
  },
  {
    name: 'Orange',
    colors: [
      { hex: 'FD8305', r: 253, g: 131, b: 5, shade: 'main' },
      { hex: 'B55E04', r: 181, g: 94, b: 4, shade: 'dark' },
      { hex: '804203', r: 128, g: 66, b: 3, shade: 'darker' },
    ],
  },
  {
    name: 'Yellow',
    colors: [
      { hex: 'FDE91A', r: 253, g: 233, b: 26, shade: 'main' },
      { hex: 'B5A713', r: 181, g: 167, b: 19, shade: 'dark' },
      { hex: '80760D', r: 128, g: 118, b: 13, shade: 'darker' },
    ],
  },
  {
    name: 'Green',
    colors: [
      { hex: '49CB05', r: 73, g: 203, b: 5, shade: 'main' },
      { hex: '349104', r: 52, g: 145, b: 4, shade: 'dark' },
      { hex: '256603', r: 37, g: 102, b: 3, shade: 'darker' },
    ],
  },
  {
    name: 'Cyan',
    colors: [
      { hex: '39B1DB', r: 57, g: 177, b: 219, shade: 'main' },
      { hex: '297F9D', r: 41, g: 127, b: 157, shade: 'dark' },
      { hex: '1D596F', r: 29, g: 89, b: 111, shade: 'darker' },
    ],
  },
  {
    name: 'Blue',
    colors: [
      { hex: '4432D4', r: 68, g: 50, b: 212, shade: 'main' },
      { hex: '312498', r: 49, g: 36, b: 152, shade: 'dark' },
      { hex: '23196B', r: 35, g: 25, b: 107, shade: 'darker' },
    ],
  },
  {
    name: 'Purple',
    colors: [
      { hex: '7F20CA', r: 127, g: 32, b: 202, shade: 'main' },
      { hex: '5B1791', r: 91, g: 23, b: 145, shade: 'dark' },
      { hex: '401066', r: 64, g: 16, b: 102, shade: 'darker' },
    ],
  },
  {
    name: 'Pink',
    colors: [
      { hex: 'DB45D0', r: 219, g: 69, b: 208, shade: 'main' },
      { hex: '9D3195', r: 157, g: 49, b: 149, shade: 'dark' },
      { hex: '6F2369', r: 111, g: 35, b: 105, shade: 'darker' },
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

// Get colors by shade type
function getColorsByShade(groupName: string, shade: 'main' | 'dark' | 'darker'): PaletteColor | null {
  for (const group of PALETTE_GROUPS) {
    if (group.name === groupName) {
      for (const color of group.colors) {
        if (color.shade === shade) {
          return { ...color, groupName };
        }
      }
    }
  }
  return null;
}

export interface ProcessingOptions {
  fallbackMode: 'transparent' | 'fallback';
  fallbackCapPercent: number;
  closenessThreshold: number;
  maxColorsUsed: number;
  symmetryMode: 'none' | 'vertical' | 'horizontal';
  detailLevel: number;
  // AI Enhancement options
  outlineMode: 'none' | 'subtle' | 'bold';
  shading: boolean;
  dithering: boolean;
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

// Seeded random for consistent results
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Center crop and scale image to 36x36
export function preprocessImage(image: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 36;
  canvas.height = 36;
  const ctx = canvas.getContext('2d')!;
  
  const size = Math.min(image.width, image.height);
  const sx = (image.width - size) / 2;
  const sy = (image.height - size) / 2;
  
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, sx, sy, size, size, 0, 0, 36, 36);
  
  return ctx.getImageData(0, 0, 36, 36);
}

// Get pixel color at position
function getPixel(data: Uint8ClampedArray, x: number, y: number, width: number): { r: number; g: number; b: number; a: number } | null {
  if (x < 0 || x >= width || y < 0 || y >= 36) return null;
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

// Check if pixel is on an edge (different color neighbor or transparent neighbor)
function isEdgePixel(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
  const current = getPixel(data, x, y, width);
  if (!current || current.a === 0) return false;
  
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dy] of directions) {
    const neighbor = getPixel(data, x + dx, y + dy, width);
    if (!neighbor || neighbor.a === 0) return true;
    if (neighbor.r !== current.r || neighbor.g !== current.g || neighbor.b !== current.b) {
      return true;
    }
  }
  return false;
}

// Find the palette group for a color
function findColorGroup(r: number, g: number, b: number): string | null {
  for (const group of PALETTE_GROUPS) {
    for (const color of group.colors) {
      if (color.r === r && color.g === g && color.b === b) {
        return group.name;
      }
    }
  }
  return null;
}

// Main processing function
export function processPixelArt(
  sourceData: ImageData,
  options: ProcessingOptions
): ProcessedResult {
  const { data } = sourceData;
  const width = 36;
  const height = 36;
  
  const output = new Uint8ClampedArray(data.length);
  const allColors = getAllPaletteColors();
  
  // Determine which color groups are allowed
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
  
  const allowedGroups = Array.from(groupFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, options.maxColorsUsed)
    .map(([name]) => name);
  
  const allowedColors = allColors.filter(c => allowedGroups.includes(c.groupName));
  const threshold = options.closenessThreshold * 441;
  
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
    
    if (a < 128) {
      output[i] = 0;
      output[i + 1] = 0;
      output[i + 2] = 0;
      output[i + 3] = 0;
      continue;
    }
    
    const { color: nearestColor, distance } = findNearestPaletteColor(r, g, b, allowedColors);
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
      if (options.fallbackMode === 'transparent') {
        output[i] = 0;
        output[i + 1] = 0;
        output[i + 2] = 0;
        output[i + 3] = 0;
      } else {
        const luminance = getLuminance(r, g, b);
        if (luminance < 30) {
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
    fallbackPixels.sort((a, b) => a.distance - b.distance);
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
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (output[i + 3] === 0) continue;
        
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
  
  // ========== AI ENHANCEMENT: Shading ==========
  // Apply shading based on position (simulates light from top-left)
  if (options.shading) {
    const tempOutput = new Uint8ClampedArray(output);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (tempOutput[i + 3] === 0) continue;
        
        const r = tempOutput[i];
        const g = tempOutput[i + 1];
        const b = tempOutput[i + 2];
        
        const groupName = findColorGroup(r, g, b);
        if (!groupName) continue;
        
        // Check neighbors to determine shading
        const topLeft = getPixel(tempOutput, x - 1, y - 1, width);
        const top = getPixel(tempOutput, x, y - 1, width);
        const left = getPixel(tempOutput, x - 1, y, width);
        const bottomRight = getPixel(tempOutput, x + 1, y + 1, width);
        const bottom = getPixel(tempOutput, x, y + 1, width);
        const right = getPixel(tempOutput, x + 1, y, width);
        
        // Light comes from top-left, shadow on bottom-right
        const isHighlight = (!topLeft || topLeft.a === 0) || (!top || top.a === 0) || (!left || left.a === 0);
        const isShadow = (!bottomRight || bottomRight.a === 0) || (!bottom || bottom.a === 0) || (!right || right.a === 0);
        
        // Only apply if it's an edge and use seeded random for variation
        const seed = x * 100 + y;
        const rand = seededRandom(seed);
        
        if (isHighlight && !isShadow && rand > 0.6) {
          // Keep main color (brightest)
          const mainColor = getColorsByShade(groupName, 'main');
          if (mainColor) {
            output[i] = mainColor.r;
            output[i + 1] = mainColor.g;
            output[i + 2] = mainColor.b;
          }
        } else if (isShadow && !isHighlight && rand > 0.5) {
          // Use darker shade
          const darkColor = getColorsByShade(groupName, 'darker');
          if (darkColor) {
            output[i] = darkColor.r;
            output[i + 1] = darkColor.g;
            output[i + 2] = darkColor.b;
          }
        } else if (rand > 0.7) {
          // Some interior variation
          const darkColor = getColorsByShade(groupName, 'dark');
          if (darkColor) {
            output[i] = darkColor.r;
            output[i + 1] = darkColor.g;
            output[i + 2] = darkColor.b;
          }
        }
      }
    }
  }
  
  // ========== AI ENHANCEMENT: Dithering ==========
  // Apply ordered dithering for smoother transitions
  if (options.dithering) {
    const bayerMatrix = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (output[i + 3] === 0) continue;
        
        const r = output[i];
        const g = output[i + 1];
        const b = output[i + 2];
        
        const groupName = findColorGroup(r, g, b);
        if (!groupName) continue;
        
        // Get bayer threshold
        const bayerValue = bayerMatrix[y % 4][x % 4] / 16;
        
        // Apply dithering between shades based on position
        const seed = x * 31 + y * 17;
        const rand = seededRandom(seed);
        
        if (bayerValue > 0.5 && rand > 0.6) {
          const darkColor = getColorsByShade(groupName, 'dark');
          if (darkColor) {
            output[i] = darkColor.r;
            output[i + 1] = darkColor.g;
            output[i + 2] = darkColor.b;
          }
        }
      }
    }
  }
  
  // ========== AI ENHANCEMENT: Outline ==========
  // Add outlines around shapes for hand-drawn look
  if (options.outlineMode !== 'none') {
    const tempOutput = new Uint8ClampedArray(output);
    const outlineColor = options.outlineMode === 'bold' 
      ? { r: 30, g: 20, b: 40 }  // Dark purple-black
      : { r: 60, g: 50, b: 70 }; // Subtle dark
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (tempOutput[i + 3] === 0) continue;
        
        const r = tempOutput[i];
        const g = tempOutput[i + 1];
        const b = tempOutput[i + 2];
        
        // Check if this is an edge pixel
        const isEdge = isEdgePixel(tempOutput, x, y, width);
        
        if (isEdge) {
          // Check which neighbors are different/transparent to determine outline position
          const directions = [
            { dx: 1, dy: 0 },   // right
            { dx: 0, dy: 1 },   // bottom
            { dx: 1, dy: 1 },   // bottom-right
          ];
          
          for (const { dx, dy } of directions) {
            const neighbor = getPixel(tempOutput, x + dx, y + dy, width);
            if (!neighbor || neighbor.a === 0 || 
                neighbor.r !== r || neighbor.g !== g || neighbor.b !== b) {
              // Apply subtle darkening to this pixel for outline effect
              const groupName = findColorGroup(r, g, b);
              if (groupName) {
                const darkerColor = getColorsByShade(groupName, 'darker');
                if (darkerColor) {
                  output[i] = darkerColor.r;
                  output[i + 1] = darkerColor.g;
                  output[i + 2] = darkerColor.b;
                }
              }
              break;
            }
          }
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
        
        output[bottomI] = output[topI];
        output[bottomI + 1] = output[topI + 1];
        output[bottomI + 2] = output[topI + 2];
        output[bottomI + 3] = output[topI + 3];
      }
    }
  }
  
  // Calculate final stats
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
  canvas.width = 36 * scale;
  canvas.height = 36 * scale;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 36;
  tempCanvas.height = 36;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.putImageData(imageData, 0, 0);
  
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
