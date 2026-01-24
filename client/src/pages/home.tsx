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
import { Switch } from '@/components/ui/switch';
import { Upload, Download, RefreshCw, ImageIcon, Sparkles, Grid3X3, Wand2 } from 'lucide-react';
import {
  PALETTE_GROUPS,
  ProcessingOptions,
  ProcessingStats,
  preprocessImage,
  processPixelArt,
  drawToCanvas,
  exportAsPng,
} from '@/lib/pixelArtProcessor';

const defaultOptions: ProcessingOptions = {
  fallbackMode: 'fallback',
  fallbackCapPercent: 7,
  closenessThreshold: 0.3,
  maxColorsUsed: 8,
  symmetryMode: 'none',
  detailLevel: 0.5,
  outlineMode: 'subtle',
  shading: true,
  dithering: false,
};

export default function Home() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ImageData | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [options, setOptions] = useState<ProcessingOptions>(defaultOptions);
  const [isDragging, setIsDragging] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(() => {
    if (!sourceImage) return;
    
    const sourceData = preprocessImage(sourceImage);
    const result = processPixelArt(sourceData, options);
    
    setProcessedData(result.imageData);
    setStats(result.stats);
    
    if (canvasRef.current) {
      drawToCanvas(canvasRef.current, result.imageData, 10);
    }
  }, [sourceImage, options]);

  useEffect(() => {
    if (sourceImage) {
      processImage();
    }
  }, [processImage, sourceImage]);

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        setSourceImageUrl(e.target?.result as string);
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
      exportAsPng(processedData);
    }
  };

  const handleReset = () => {
    setSourceImage(null);
    setSourceImageUrl(null);
    setProcessedData(null);
    setStats(null);
    setOptions(defaultOptions);
  };

  const updateOption = <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
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
            Transform any image into minimalistic 36x36 pixel art with a curated 8-color palette
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
                      <Download className="w-4 h-4 mr-2" />
                      Export PNG
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
                    <Label className="text-sm text-muted-foreground mb-3 block">
                      Original Image
                    </Label>
                    <div className="bg-muted rounded-md p-4 flex items-center justify-center min-h-[320px]">
                      {sourceImageUrl && (
                        <img
                          src={sourceImageUrl}
                          alt="Original"
                          className="max-w-full max-h-72 object-contain rounded"
                          data-testid="img-original"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-3 block">
                      Pixel Art Output (36x36)
                    </Label>
                    <div className="bg-muted rounded-md p-4 flex items-center justify-center min-h-[320px]">
                      <canvas
                        ref={canvasRef}
                        className="crisp-pixels rounded border border-border"
                        style={{ width: 288, height: 288 }}
                        data-testid="canvas-preview"
                      />
                    </div>
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
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
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
                    max={8}
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
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-muted-foreground" />
                AI Enhancement
              </h2>
              <p className="text-xs text-muted-foreground mb-4">
                Make your pixel art look handcrafted
              </p>
              
              <div className="space-y-5">
                <div>
                  <Label className="text-sm mb-2 block">Outline Style</Label>
                  <Select
                    value={options.outlineMode}
                    onValueChange={(value: 'none' | 'subtle' | 'bold') =>
                      updateOption('outlineMode', value)
                    }
                  >
                    <SelectTrigger data-testid="select-outline">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="subtle">Subtle</SelectItem>
                      <SelectItem value="bold">Bold</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Add hand-drawn style outlines around shapes
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Light & Shadow</Label>
                    <p className="text-xs text-muted-foreground">
                      Apply shading based on light direction
                    </p>
                  </div>
                  <Switch
                    checked={options.shading}
                    onCheckedChange={(checked) => updateOption('shading', checked)}
                    data-testid="switch-shading"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Dithering</Label>
                    <p className="text-xs text-muted-foreground">
                      Add texture patterns for smoother transitions
                    </p>
                  </div>
                  <Switch
                    checked={options.dithering}
                    onCheckedChange={(checked) => updateOption('dithering', checked)}
                    data-testid="switch-dithering"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Color Palette</h2>
              <p className="text-xs text-muted-foreground mb-3">
                8 color groups, each with main + 2 darker shades
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
