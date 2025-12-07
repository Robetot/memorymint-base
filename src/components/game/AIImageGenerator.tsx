import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Sparkles, Wand2, RefreshCw, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIImageGeneratorProps {
  score: number;
  onBack: () => void;
  onComplete: () => void;
}

const STYLE_OPTIONS = [
  { id: 'classic', name: 'Classic Oil', prompt: 'oil painting style, classical art, rich colors, brushwork texture' },
  { id: 'pixel', name: 'Pixel Retro', prompt: 'pixel art style, 8-bit retro, vibrant colors, nostalgic' },
  { id: 'anime', name: 'Anime', prompt: 'anime style, Japanese animation, vibrant, detailed' },
  { id: '3d', name: '3D Sculpt', prompt: '3D rendered, clay sculpture, soft lighting, depth' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', prompt: 'cyberpunk style, neon lights, futuristic, dark atmosphere' },
  { id: 'gothic', name: 'Dark Gothic', prompt: 'dark gothic style, mysterious, dramatic shadows, ornate details' },
  { id: 'fantasy', name: 'Mythic Fantasy', prompt: 'fantasy art style, magical, ethereal, epic composition' },
];

export function AIImageGenerator({ score, onBack, onComplete }: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [rollsRemaining, setRollsRemaining] = useState(3);

  const handleGenerate = async () => {
    if (!prompt.trim() || !selectedStyle) return;
    
    const style = STYLE_OPTIONS.find(s => s.id === selectedStyle);
    if (!style) return;

    setIsGenerating(true);
    
    // Simulate AI generation (replace with actual API call when backend is connected)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo, use a placeholder image
    const placeholderImages = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=512&h=512&fit=crop',
      'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=512&h=512&fit=crop',
      'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=512&h=512&fit=crop',
    ];
    
    setGeneratedImage(placeholderImages[Math.floor(Math.random() * placeholderImages.length)]);
    setRollsRemaining(prev => prev - 1);
    setIsGenerating(false);
  };

  const handleReroll = async () => {
    if (rollsRemaining <= 0) return;
    await handleGenerate();
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `memorymint-${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background py-6 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
              Create Your NFT Art
            </h1>
            <p className="text-xs text-muted-foreground">Score: {score.toLocaleString()}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {!generatedImage ? (
          <>
            {/* Prompt Input */}
            <div className="mb-6">
              <label className="block text-sm font-display font-medium text-foreground mb-2">
                Describe Your Art
              </label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A majestic dragon flying over mountains..."
                className="text-lg py-6"
              />
            </div>

            {/* Style Selection */}
            <div className="mb-8">
              <label className="block text-sm font-display font-medium text-foreground mb-3">
                Choose Art Style
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={cn(
                      'p-4 rounded-xl border-2 text-center transition-all',
                      selectedStyle === style.id
                        ? 'border-primary bg-primary/10 shadow-lg'
                        : 'border-border hover:border-primary/50 bg-card'
                    )}
                  >
                    <p className="font-display font-medium text-foreground text-sm">
                      {style.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !selectedStyle || isGenerating}
              size="lg"
              className="w-full text-lg font-display bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5 mr-2" />
                  Generate Art
                </>
              )}
            </Button>
          </>
        ) : (
          <>
            {/* Generated Image */}
            <div className="mb-6">
              <div className="relative aspect-square rounded-2xl overflow-hidden border-4 border-primary shadow-2xl">
                <img
                  src={generatedImage}
                  alt="Generated AI Art"
                  className="w-full h-full object-cover"
                />
                {isGenerating && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <div className="flex gap-3">
                <Button
                  onClick={handleReroll}
                  disabled={rollsRemaining <= 0 || isGenerating}
                  variant="outline"
                  size="lg"
                  className="flex-1 font-display"
                >
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Re-roll ({rollsRemaining} left)
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  size="lg"
                  className="flex-1 font-display"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download
                </Button>
              </div>

              <Button
                onClick={onComplete}
                size="lg"
                className="w-full text-lg font-display bg-gradient-to-r from-primary to-secondary"
                disabled
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Mint as NFT (Coming Soon)
              </Button>

              <Button
                onClick={onBack}
                variant="ghost"
                className="w-full font-body text-muted-foreground"
              >
                Back to Menu
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
