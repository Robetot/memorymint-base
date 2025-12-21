import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Sparkles, Layers, Plus, Trash2, Loader2, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface BatchImageGeneratorProps {
  onBack: () => void;
  onSelectImage: (image: string) => void;
}

const STYLE_OPTIONS = [
  { id: 'classic', name: 'Classic Oil', prompt: 'oil painting style, classical art, rich colors, brushwork texture' },
  { id: 'pixel', name: 'Pixel Retro', prompt: 'pixel art style, 8-bit retro, vibrant colors, nostalgic' },
  { id: 'anime', name: 'Anime', prompt: 'anime style, Japanese animation, vibrant, detailed' },
  { id: '3d', name: '3D Sculpt', prompt: '3D rendered, clay sculpture, soft lighting, depth' },
  { id: 'cyberpunk', name: 'Cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic, dark atmosphere' },
  { id: 'gothic', name: 'Gothic', prompt: 'dark gothic style, mysterious, dramatic shadows, ornate details' },
  { id: 'fantasy', name: 'Fantasy', prompt: 'fantasy art style, magical, ethereal, epic composition' },
];

const PRESET_PROMPTS = [
  'A majestic dragon',
  'A cute robot companion',
  'A mystical forest spirit',
  'A cosmic phoenix',
  'An ancient wizard',
  'A steampunk airship',
];

export function BatchImageGenerator({ onBack, onSelectImage }: BatchImageGeneratorProps) {
  const [prompts, setPrompts] = useState<Array<{ prompt: string; styleId: string }>>([
    { prompt: '', styleId: 'classic' }
  ]);
  const [showResults, setShowResults] = useState(false);

  const { images, isGenerating, progress, generateBatch, resetBatch, estimatedCost } = useBatchGenerate();

  const addPrompt = () => {
    if (prompts.length >= 5) {
      toast.error('Maximum 5 images per batch');
      return;
    }
    setPrompts([...prompts, { prompt: '', styleId: 'classic' }]);
  };

  const removePrompt = (index: number) => {
    if (prompts.length <= 1) return;
    setPrompts(prompts.filter((_, i) => i !== index));
  };

  const updatePrompt = (index: number, field: 'prompt' | 'styleId', value: string) => {
    const updated = [...prompts];
    updated[index] = { ...updated[index], [field]: value };
    setPrompts(updated);
  };

  const applyPreset = (preset: string, index: number) => {
    updatePrompt(index, 'prompt', preset);
  };

  const handleGenerate = async () => {
    const validPrompts = prompts.filter(p => p.prompt.trim());
    if (validPrompts.length === 0) {
      toast.error('Add at least one prompt');
      return;
    }

    const batchData = validPrompts.map(p => {
      const style = STYLE_OPTIONS.find(s => s.id === p.styleId)!;
      return {
        prompt: p.prompt,
        style: style.prompt,
        styleName: style.name,
      };
    });

    await generateBatch(batchData);
    setShowResults(true);
  };

  const handleSelectAndClose = (image: string) => {
    onSelectImage(image);
    resetBatch();
    setShowResults(false);
  };

  const handleDownloadAll = async () => {
    const successImages = images.filter(img => img.status === 'success' && img.image);
    
    for (let i = 0; i < successImages.length; i++) {
      const img = successImages[i];
      if (!img.image) continue;
      
      try {
        const response = await fetch(img.image);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `batch-${i + 1}-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Download failed:', error);
      }
    }
    
    toast.success(`Downloaded ${successImages.length} images`);
  };

  const validCount = prompts.filter(p => p.prompt.trim()).length;

  if (showResults && images.length > 0) {
    const successImages = images.filter(img => img.status === 'success');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button variant="ghost" size="icon" onClick={() => setShowResults(false)} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-display font-bold text-foreground">
              Batch Results ({successImages.length}/{images.length})
            </h1>
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Progress during generation */}
          {isGenerating && (
            <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium">Generating batch...</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {Math.round(progress)}% complete
              </p>
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            {images.map((img) => (
              <div 
                key={img.id}
                className={cn(
                  "relative aspect-square rounded-xl border-2 overflow-hidden transition-all",
                  img.status === 'success' && "border-success cursor-pointer hover:scale-[1.02]",
                  img.status === 'error' && "border-destructive",
                  img.status === 'generating' && "border-primary animate-pulse",
                  img.status === 'pending' && "border-border"
                )}
                onClick={() => img.status === 'success' && img.image && handleSelectAndClose(img.image)}
              >
                {img.status === 'success' && img.image ? (
                  <>
                    <img src={img.image} alt={img.prompt} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Select</span>
                    </div>
                    <div className="absolute top-2 right-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                  </>
                ) : img.status === 'error' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-destructive/10">
                    <AlertCircle className="w-8 h-8 text-destructive mb-2" />
                    <p className="text-xs text-destructive text-center line-clamp-2">{img.error}</p>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
                
                {/* Style badge */}
                <div className="absolute bottom-2 left-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-background/80 text-foreground">
                    {img.style}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          {!isGenerating && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownloadAll}
                disabled={successImages.length === 0}
              >
                <Download className="w-4 h-4 mr-2" />
                Download All ({successImages.length})
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  resetBatch();
                  setShowResults(false);
                }}
              >
                Generate More
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Batch Generate
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Create multiple NFT variants at once
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Cost Estimate */}
        <div className="mb-4 p-3 rounded-xl bg-muted/50 border border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Estimated cost</span>
          <span className="font-mono font-medium text-foreground">
            ~${estimatedCost(validCount)} for {validCount} image{validCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Prompt List */}
        <div className="space-y-4 mb-6">
          {prompts.map((p, index) => (
            <div key={index} className="p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-foreground">Image {index + 1}</span>
                {prompts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removePrompt(index)}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              
              <Input
                value={p.prompt}
                onChange={(e) => updatePrompt(index, 'prompt', e.target.value)}
                placeholder="Describe your artwork..."
                className="mb-3"
              />
              
              {/* Quick presets */}
              <div className="flex flex-wrap gap-1 mb-3">
                {PRESET_PROMPTS.slice(0, 3).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset, index)}
                    className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              
              {/* Style selector */}
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => updatePrompt(index, 'styleId', style.id)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-all",
                      p.styleId === style.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add More Button */}
        {prompts.length < 5 && (
          <Button
            variant="outline"
            className="w-full mb-6"
            onClick={addPrompt}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Image
          </Button>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={validCount === 0 || isGenerating}
          size="lg"
          className="w-full text-lg font-display bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Generating {validCount} images...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Batch (~${estimatedCost(validCount)})
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground mt-3">
          Images are generated sequentially to avoid rate limits
        </p>
      </div>
    </div>
  );
}
