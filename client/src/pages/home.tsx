import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Upload, FileJson, RefreshCw, ImageIcon, Sparkles, Grid3X3, Trash2, X, Crop } from 'lucide-react';
import {
  PALETTE_GROUPS,
  ProcessingOptions,
  ProcessingStats,
  CropRegion,
  preprocessImage,
  processPixelArt,
  drawToCanvas,
  exportAsJson,
  getDefaultCrop,
  MIN_OUTPUT_SIZE,
  MAX_OUTPUT_SIZE,
  DEFAULT_OUTPUT_SIZE,
} from '@/lib/pixelArtProcessor';

const defaultOptions: ProcessingOptions = {
  fallbackMode: 'fallback',
  fallbackCapPercent: 7,
  closenessThreshold: 0.3,
  maxColorsUsed: 9,
  symmetryMode: 'none',
  detailLevel: 0.5,
};

interface SelectedColorGroup {
  name: string;
  position: { x: number; y: number };
}

type DragHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | 'move' | null;

export default function Home() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ImageData | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>(defaultOptions);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedColor, setSelectedColor] = useState<SelectedColorGroup | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const [cropRegion, setCropRegion] = useState<CropRegion | null>(null);
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; crop: CropRegion } | null>(null);
  const [outputSize, setOutputSize] = useState<number>(DEFAULT_OUTPUT_SIZE);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  const processImage = useCallback(() => {
    if (!sourceImage || !cropRegion) return;
    
    const sourceData = preprocessImage(sourceImage, outputSize, cropRegion);
    const result = processPixelArt(sourceData, options);
    
    setProcessedData(result.imageData);
    setStats(result.stats);
    
    if (canvasRef.current) {
      drawToCanvas(canvasRef.current, result.imageData, 10);
    }
  }, [sourceImage, cropRegion, options, outputSize]);

  useEffect(() => {
    if (sourceImage && cropRegion) {
      processImage();
    }
  }, [processImage, sourceImage, cropRegion]);

  const recalculateStats = useCallback((imageData: ImageData) => {
    const paletteUsage = new Map<string, number>();
    PALETTE_GROUPS.forEach(g => paletteUsage.set(g.name, 0));
    
    let transparentCount = 0;
    let fallbackCount = 0;
    let opaqueCount = 0;
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) {
        transparentCount++;
        continue;
      }
      
      opaqueCount++;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
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
    
    setStats({
      fallbackPercent: opaqueCount > 0 ? (fallbackCount / opaqueCount) * 100 : 0,
      transparentPixels: transparentCount,
      paletteUsage
    });
  }, []);

  const getImageDisplayScale = useCallback(() => {
    if (!cropImageRef.current || !sourceImage) return 1;
    return cropImageRef.current.clientWidth / sourceImage.width;
  }, [sourceImage]);

  const handleCropMouseDown = (e: React.MouseEvent, handle: DragHandle) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cropRegion) return;
    
    setDragHandle(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      crop: { ...cropRegion }
    });
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!dragHandle || !dragStart || !sourceImage || !cropRegion) return;
    
    const scale = getImageDisplayScale();
    const dx = (e.clientX - dragStart.x) / scale;
    const dy = (e.clientY - dragStart.y) / scale;
    
    // Calculate min/max crop size based on output constraints
    const imageMinDim = Math.min(sourceImage.width, sourceImage.height);
    const minCropSize = Math.max(MIN_OUTPUT_SIZE, imageMinDim * (MIN_OUTPUT_SIZE / MAX_OUTPUT_SIZE));
    const maxCropSize = imageMinDim;
    
    let newCrop = { ...dragStart.crop };
    
    if (dragHandle === 'move') {
      newCrop.x = Math.max(0, Math.min(sourceImage.width - newCrop.width, dragStart.crop.x + dx));
      newCrop.y = Math.max(0, Math.min(sourceImage.height - newCrop.height, dragStart.crop.y + dy));
    } else {
      // For corner handles, use average delta to maintain square
      // For edge handles, use the primary axis delta
      let delta = 0;
      
      if (dragHandle === 'nw' || dragHandle === 'ne' || dragHandle === 'sw' || dragHandle === 'se') {
        // Corner: average of both deltas, accounting for direction
        const signX = dragHandle.includes('e') ? 1 : -1;
        const signY = dragHandle.includes('s') ? 1 : -1;
        delta = (dx * signX + dy * signY) / 2;
      } else if (dragHandle === 'n' || dragHandle === 's') {
        delta = dragHandle === 's' ? dy : -dy;
      } else if (dragHandle === 'e' || dragHandle === 'w') {
        delta = dragHandle === 'e' ? dx : -dx;
      }
      
      // Calculate new size
      let newSize = dragStart.crop.width + delta;
      newSize = Math.max(minCropSize, Math.min(maxCropSize, newSize));
      
      // Constrain to image bounds
      const maxFromX = sourceImage.width - dragStart.crop.x;
      const maxFromY = sourceImage.height - dragStart.crop.y;
      
      // Adjust position based on handle
      if (dragHandle.includes('w')) {
        const sizeChange = newSize - dragStart.crop.width;
        const newX = dragStart.crop.x - sizeChange;
        if (newX < 0) {
          newSize = dragStart.crop.width + dragStart.crop.x;
        }
        newCrop.x = Math.max(0, dragStart.crop.x - (newSize - dragStart.crop.width));
      } else {
        if (newSize > maxFromX) newSize = maxFromX;
      }
      
      if (dragHandle.includes('n')) {
        const sizeChange = newSize - dragStart.crop.height;
        const newY = dragStart.crop.y - sizeChange;
        if (newY < 0) {
          newSize = dragStart.crop.height + dragStart.crop.y;
        }
        newCrop.y = Math.max(0, dragStart.crop.y - (newSize - dragStart.crop.height));
      } else {
        if (newSize > maxFromY) newSize = maxFromY;
      }
      
      newSize = Math.max(minCropSize, newSize);
      newCrop.width = newSize;
      newCrop.height = newSize;
    }
    
    setCropRegion(newCrop);
    
    // Update output size based on crop size ratio
    const cropRatio = newCrop.width / imageMinDim;
    const newOutputSize = Math.round(MIN_OUTPUT_SIZE + (MAX_OUTPUT_SIZE - MIN_OUTPUT_SIZE) * cropRatio);
    setOutputSize(Math.max(MIN_OUTPUT_SIZE, Math.min(MAX_OUTPUT_SIZE, newOutputSize)));
  }, [dragHandle, dragStart, sourceImage, cropRegion, getImageDisplayScale]);

  const handleCropMouseUp = useCallback(() => {
    setDragHandle(null);
    setDragStart(null);
  }, []);

  useEffect(() => {
    if (dragHandle) {
      window.addEventListener('mousemove', handleCropMouseMove);
      window.addEventListener('mouseup', handleCropMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleCropMouseMove);
        window.removeEventListener('mouseup', handleCropMouseUp);
      };
    }
  }, [dragHandle, handleCropMouseMove, handleCropMouseUp]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processedData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const size = processedData.width;
    const scaleX = size / rect.width;
    const scaleY = size / rect.height;
    
    const pixelX = Math.floor((e.clientX - rect.left) * scaleX);
    const pixelY = Math.floor((e.clientY - rect.top) * scaleY);
    
    if (pixelX < 0 || pixelX >= size || pixelY < 0 || pixelY >= size) return;
    
    const i = (pixelY * size + pixelX) * 4;
    const r = processedData.data[i];
    const g = processedData.data[i + 1];
    const b = processedData.data[i + 2];
    const a = processedData.data[i + 3];
    
    if (a === 0) {
      setSelectedColor(null);
      setShowColorPicker(false);
      return;
    }
    
    for (const group of PALETTE_GROUPS) {
      for (const color of group.colors) {
        if (color.r === r && color.g === g && color.b === b) {
          setSelectedColor({
            name: group.name,
            position: { x: e.clientX, y: e.clientY }
          });
          setShowColorPicker(true);
          return;
        }
      }
    }
    
    setSelectedColor(null);
    setShowColorPicker(false);
  };

  const handleDeleteColor = () => {
    if (!selectedColor || !processedData) return;
    
    const newData = new Uint8ClampedArray(processedData.data);
    const group = PALETTE_GROUPS.find(g => g.name === selectedColor.name);
    if (!group) return;
    
    for (let i = 0; i < newData.length; i += 4) {
      const r = newData[i];
      const g = newData[i + 1];
      const b = newData[i + 2];
      
      for (const color of group.colors) {
        if (color.r === r && color.g === g && color.b === b) {
          newData[i] = 0;
          newData[i + 1] = 0;
          newData[i + 2] = 0;
          newData[i + 3] = 0;
          break;
        }
      }
    }
    
    const size = processedData.width;
    const newImageData = new ImageData(newData, size, size);
    setProcessedData(newImageData);
    recalculateStats(newImageData);
    
    if (canvasRef.current) {
      drawToCanvas(canvasRef.current, newImageData, 10);
    }
    
    setSelectedColor(null);
    setShowColorPicker(false);
  };

  const handleReplaceColor = (replacementGroupName: string) => {
    if (!selectedColor || !processedData) return;
    
    const sourceGroup = PALETTE_GROUPS.find(g => g.name === selectedColor.name);
    const targetGroup = PALETTE_GROUPS.find(g => g.name === replacementGroupName);
    if (!sourceGroup || !targetGroup) return;
    
    const newData = new Uint8ClampedArray(processedData.data);
    
    for (let i = 0; i < newData.length; i += 4) {
      const r = newData[i];
      const g = newData[i + 1];
      const b = newData[i + 2];
      
      for (let shadeIdx = 0; shadeIdx < sourceGroup.colors.length; shadeIdx++) {
        const sourceColor = sourceGroup.colors[shadeIdx];
        if (sourceColor.r === r && sourceColor.g === g && sourceColor.b === b) {
          const targetColor = targetGroup.colors[shadeIdx];
          newData[i] = targetColor.r;
          newData[i + 1] = targetColor.g;
          newData[i + 2] = targetColor.b;
          break;
        }
      }
    }
    
    const size = processedData.width;
    const newImageData = new ImageData(newData, size, size);
    setProcessedData(newImageData);
    recalculateStats(newImageData);
    
    if (canvasRef.current) {
      drawToCanvas(canvasRef.current, newImageData, 10);
    }
    
    setSelectedColor(null);
    setShowColorPicker(false);
  };

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceImageUrl(e.target?.result as string);
        setCropRegion(getDefaultCrop(img.width, img.height));
        setOutputSize(DEFAULT_OUTPUT_SIZE);
        setSelectedColor(null);
        setShowColorPicker(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleExport = () => {
    if (processedData) {
      exportAsJson(processedData);
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setSourceImageUrl(null);
    setProcessedData(null);
    setStats(null);
    setOptions(defaultOptions);
    setCropRegion(null);
    setOutputSize(DEFAULT_OUTPUT_SIZE);
    setSelectedColor(null);
    setShowColorPicker(false);
  };

  const handleResetCrop = () => {
    if (sourceImage) {
      setCropRegion(getDefaultCrop(sourceImage.width, sourceImage.height));
      setOutputSize(DEFAULT_OUTPUT_SIZE);
    }
  };

  const updateOption = <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const selectedGroup = selectedColor 
    ? PALETTE_GROUPS.find(g => g.name === selectedColor.name)
    : null;

  const renderCropOverlay = () => {
    if (!cropRegion || !sourceImage || !cropImageRef.current) return null;
    
    const scale = getImageDisplayScale();
    const cropStyle = {
      left: cropRegion.x * scale,
      top: cropRegion.y * scale,
      width: cropRegion.width * scale,
      height: cropRegion.height * scale,
    };
    
    const handleSize = 10;
    const handleStyle = "absolute bg-white border-2 border-primary rounded-sm";
    
    return (
      <>
        <div 
          className="absolute inset-0 bg-black/50 pointer-events-none"
          style={{
            clipPath: `polygon(
              0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
              ${cropStyle.left}px ${cropStyle.top}px,
              ${cropStyle.left}px ${cropStyle.top + cropStyle.height}px,
              ${cropStyle.left + cropStyle.width}px ${cropStyle.top + cropStyle.height}px,
              ${cropStyle.left + cropStyle.width}px ${cropStyle.top}px,
              ${cropStyle.left}px ${cropStyle.top}px
            )`
          }}
        />
        <div
          className="absolute border-2 border-white border-dashed cursor-move"
          style={cropStyle}
          onMouseDown={(e) => handleCropMouseDown(e, 'move')}
          data-testid="crop-area"
        >
          <div 
            className={`${handleStyle} -left-1.5 -top-1.5 cursor-nw-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
            data-testid="crop-handle-nw"
          />
          <div 
            className={`${handleStyle} -right-1.5 -top-1.5 cursor-ne-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
            data-testid="crop-handle-ne"
          />
          <div 
            className={`${handleStyle} -left-1.5 -bottom-1.5 cursor-sw-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
            data-testid="crop-handle-sw"
          />
          <div 
            className={`${handleStyle} -right-1.5 -bottom-1.5 cursor-se-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'se')}
            data-testid="crop-handle-se"
          />
          <div 
            className={`${handleStyle} left-1/2 -translate-x-1/2 -top-1.5 cursor-n-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'n')}
            data-testid="crop-handle-n"
          />
          <div 
            className={`${handleStyle} left-1/2 -translate-x-1/2 -bottom-1.5 cursor-s-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 's')}
            data-testid="crop-handle-s"
          />
          <div 
            className={`${handleStyle} -left-1.5 top-1/2 -translate-y-1/2 cursor-w-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'w')}
            data-testid="crop-handle-w"
          />
          <div 
            className={`${handleStyle} -right-1.5 top-1/2 -translate-y-1/2 cursor-e-resize`}
            style={{ width: handleSize, height: handleSize }}
            onMouseDown={(e) => handleCropMouseDown(e, 'e')}
            data-testid="crop-handle-e"
          />
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-2 bg-primary/10 rounded-md">
              <Grid3X3 className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Pixel Art Converter</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Transform any image into minimalistic 36x36 pixel art with a curated 9-color palette
          </p>
        </header>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  Image Preview
                </h2>
                {processedData && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" data-testid="badge-output-size">
                      {outputSize}x{outputSize}px
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResetCrop}
                      data-testid="button-reset-crop"
                    >
                      <Crop className="w-4 h-4 mr-2" />
                      Reset Crop
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReset}
                      data-testid="button-reset"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleExport}
                      data-testid="button-export"
                    >
                      <FileJson className="w-4 h-4 mr-2" />
                      Export JSON
                    </Button>
                  </div>
                )}
              </div>

              {!sourceImage ? (
                <div
                  className={`border-2 border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-upload"
                >
                  <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">
                    Drop your image here
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse (PNG, JPG)
                  </p>
                  <Button variant="secondary" size="sm" data-testid="button-browse">
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    data-testid="input-file"
                  />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
                      <Crop className="w-4 h-4" />
                      Drag to crop — Original Image
                    </Label>
                    <div 
                      ref={cropContainerRef}
                      className="bg-muted rounded-md p-4 flex items-center justify-center min-h-[320px]"
                    >
                      <div className="relative inline-block select-none">
                        {sourceImageUrl && (
                          <img
                            ref={cropImageRef}
                            src={sourceImageUrl}
                            alt="Original"
                            className="max-w-full max-h-72 object-contain rounded"
                            draggable={false}
                            data-testid="img-original"
                          />
                        )}
                        {cropImageRef.current && renderCropOverlay()}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-3 block">
                      Pixel Art Output (36x36) — Click to edit colors
                    </Label>
                    <div 
                      className="bg-muted rounded-md p-4 flex items-center justify-center min-h-[320px] relative"
                    >
                      <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
                        <PopoverTrigger asChild>
                          <canvas
                            ref={canvasRef}
                            className="crisp-pixels rounded border border-border cursor-crosshair"
                            style={{ width: 288, height: 288 }}
                            onClick={handleCanvasClick}
                            data-testid="canvas-preview"
                          />
                        </PopoverTrigger>
                        {selectedColor && selectedGroup && (
                          <PopoverContent 
                            className="w-64 p-3"
                            side="right"
                            align="start"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-0.5">
                                    {selectedGroup.colors.map((color, idx) => (
                                      <div
                                        key={color.hex}
                                        className={`w-5 h-5 border border-border ${
                                          idx === 0 ? 'rounded-l' : idx === 2 ? 'rounded-r' : ''
                                        }`}
                                        style={{ backgroundColor: `#${color.hex}` }}
                                      />
                                    ))}
                                  </div>
                                  <span className="font-medium text-sm">{selectedColor.name}</span>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setShowColorPicker(false)}
                                  data-testid="button-close-picker"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={handleDeleteColor}
                                  data-testid="button-delete-color"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                              
                              <div>
                                <Label className="text-xs text-muted-foreground mb-2 block">
                                  Replace with:
                                </Label>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {PALETTE_GROUPS.filter(g => g.name !== selectedColor.name).map((group) => (
                                    <button
                                      key={group.name}
                                      className="group relative p-1 rounded hover-elevate border border-transparent hover:border-border"
                                      onClick={() => handleReplaceColor(group.name)}
                                      title={group.name}
                                      data-testid={`button-replace-${group.name.toLowerCase()}`}
                                    >
                                      <div className="flex gap-px">
                                        {group.colors.map((color, idx) => (
                                          <div
                                            key={color.hex}
                                            className={`w-3 h-6 ${
                                              idx === 0 ? 'rounded-l-sm' : idx === 2 ? 'rounded-r-sm' : ''
                                            }`}
                                            style={{ backgroundColor: `#${color.hex}` }}
                                          />
                                        ))}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        )}
                      </Popover>
                    </div>
                    {processedData && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        Click on any color to delete or replace it
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {stats && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                  Color Statistics
                </h2>
                
                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted rounded-md p-4">
                    <div className="text-2xl font-bold text-foreground">
                      {stats.fallbackPercent.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Fallback Pixels
                    </div>
                  </div>
                  <div className="bg-muted rounded-md p-4">
                    <div className="text-2xl font-bold text-foreground">
                      {stats.transparentPixels}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Transparent Pixels
                    </div>
                  </div>
                  <div className="bg-muted rounded-md p-4">
                    <div className="text-2xl font-bold text-foreground">
                      {Array.from(stats.paletteUsage.values()).filter(v => v > 0).length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Colors Used
                    </div>
                  </div>
                </div>

                <Label className="text-sm text-muted-foreground mb-3 block">
                  Palette Usage (grouped by color)
                </Label>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-3">
                  {PALETTE_GROUPS.map((group) => {
                    const count = stats.paletteUsage.get(group.name) || 0;
                    const total = 36 * 36;
                    const percent = ((count / total) * 100).toFixed(1);
                    
                    return (
                      <div key={group.name} className="text-center">
                        <div className="flex gap-0.5 mb-2">
                          {group.colors.map((color, idx) => (
                            <div
                              key={color.hex}
                              className={`flex-1 aspect-square border border-border ${
                                idx === 0 ? 'rounded-l-md' : idx === 2 ? 'rounded-r-md' : ''
                              }`}
                              style={{ backgroundColor: `#${color.hex}` }}
                              title={`${group.name} (${color.shade}): #${color.hex}`}
                            />
                          ))}
                        </div>
                        <div className="text-xs font-medium">{count}</div>
                        <div className="text-xs text-muted-foreground">
                          {percent}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Controls</h2>
              
              <div className="space-y-5">
                <div>
                  <Label className="text-sm mb-2 block">Fallback Mode</Label>
                  <Select
                    value={options.fallbackMode}
                    onValueChange={(value: 'transparent' | 'fallback') =>
                      updateOption('fallbackMode', value)
                    }
                  >
                    <SelectTrigger data-testid="select-fallback-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fallback">Keep Fallback Colors</SelectItem>
                      <SelectItem value="transparent">Make Transparent</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    How to handle pixels not matching the palette
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Fallback Pixel Cap</Label>
                    <Badge variant="secondary" className="text-xs">
                      {options.fallbackCapPercent}%
                    </Badge>
                  </div>
                  <Slider
                    value={[options.fallbackCapPercent]}
                    min={5}
                    max={10}
                    step={1}
                    onValueChange={([value]) =>
                      updateOption('fallbackCapPercent', value)
                    }
                    data-testid="slider-fallback-cap"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Maximum allowed fallback pixels (5-10%)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Color Threshold</Label>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(options.closenessThreshold * 100)}%
                    </Badge>
                  </div>
                  <Slider
                    value={[options.closenessThreshold * 100]}
                    min={5}
                    max={80}
                    step={5}
                    onValueChange={([value]) =>
                      updateOption('closenessThreshold', value / 100)
                    }
                    data-testid="slider-closeness"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    How close a color must be to match the palette
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Max Palette Colors</Label>
                    <Badge variant="secondary" className="text-xs">
                      {options.maxColorsUsed}
                    </Badge>
                  </div>
                  <Slider
                    value={[options.maxColorsUsed]}
                    min={1}
                    max={9}
                    step={1}
                    onValueChange={([value]) =>
                      updateOption('maxColorsUsed', value)
                    }
                    data-testid="slider-max-colors"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Limit the number of color groups used
                  </p>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">Symmetry Mode</Label>
                  <Select
                    value={options.symmetryMode}
                    onValueChange={(value: 'none' | 'vertical' | 'horizontal') =>
                      updateOption('symmetryMode', value)
                    }
                  >
                    <SelectTrigger data-testid="select-symmetry">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="vertical">Vertical Mirror</SelectItem>
                      <SelectItem value="horizontal">Horizontal Mirror</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Apply symmetry to the output
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Detail Level</Label>
                    <Badge variant="secondary" className="text-xs">
                      {options.detailLevel < 0.33
                        ? 'Low'
                        : options.detailLevel < 0.66
                        ? 'Medium'
                        : 'High'}
                    </Badge>
                  </div>
                  <Slider
                    value={[options.detailLevel * 100]}
                    min={0}
                    max={100}
                    step={10}
                    onValueChange={([value]) =>
                      updateOption('detailLevel', value / 100)
                    }
                    data-testid="slider-detail"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Higher = more detail, Lower = cleaner/simpler
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Color Palette</h2>
              <p className="text-xs text-muted-foreground mb-3">
                9 color groups, each with 3 shades
              </p>
              <div className="space-y-2">
                {PALETTE_GROUPS.map((group) => (
                  <div
                    key={group.name}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-muted-foreground w-14 shrink-0">
                      {group.name}
                    </span>
                    <div className="flex gap-1 flex-1">
                      {group.colors.map((color, idx) => (
                        <div
                          key={color.hex}
                          className={`group relative flex-1 h-8 border border-border ${
                            idx === 0 ? 'rounded-l-md' : idx === 2 ? 'rounded-r-md' : ''
                          }`}
                          style={{ backgroundColor: `#${color.hex}` }}
                          title={`#${color.hex}`}
                        >
                          <div className="invisible group-hover:visible absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs bg-popover text-popover-foreground px-2 py-1 rounded shadow-md whitespace-nowrap z-10">
                            #{color.hex}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <footer className="text-center mt-12 pb-8">
          <p className="text-sm text-muted-foreground">
            All processing happens locally in your browser. No images are uploaded to any server.
          </p>
        </footer>
      </div>
    </div>
  );
}
