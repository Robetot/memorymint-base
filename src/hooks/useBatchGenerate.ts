import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BatchImage {
  id: string;
  prompt: string;
  style: string;
  image: string | null;
  status: 'pending' | 'generating' | 'success' | 'error';
  error?: string;
}

interface BatchState {
  images: BatchImage[];
  isGenerating: boolean;
  progress: number;
  totalCost: number;
}

const COST_PER_IMAGE = 0.027; // ~2.7 cents based on actual usage

export function useBatchGenerate() {
  const [state, setState] = useState<BatchState>({
    images: [],
    isGenerating: false,
    progress: 0,
    totalCost: 0,
  });

  const generateBatch = useCallback(async (
    prompts: Array<{ prompt: string; style: string; styleName: string }>
  ): Promise<BatchImage[]> => {
    if (prompts.length === 0) return [];

    const batchImages: BatchImage[] = prompts.map((p, i) => ({
      id: `batch-${Date.now()}-${i}`,
      prompt: p.prompt,
      style: p.styleName,
      image: null,
      status: 'pending',
    }));

    setState({
      images: batchImages,
      isGenerating: true,
      progress: 0,
      totalCost: prompts.length * COST_PER_IMAGE,
    });

    const results: BatchImage[] = [...batchImages];
    let completed = 0;

    // Process images sequentially to avoid rate limiting
    for (let i = 0; i < prompts.length; i++) {
      const { prompt, style } = prompts[i];
      
      // Update status to generating
      results[i] = { ...results[i], status: 'generating' };
      setState(prev => ({
        ...prev,
        images: [...results],
        progress: (completed / prompts.length) * 100,
      }));

      try {
        console.log(`[Batch] Generating ${i + 1}/${prompts.length}: ${prompt.slice(0, 30)}...`);
        
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: { prompt, style },
        });

        if (error || data?.error) {
          const errorMsg = data?.error || error?.message || 'Generation failed';
          results[i] = { ...results[i], status: 'error', error: errorMsg };
          console.error(`[Batch] Error on image ${i + 1}:`, errorMsg);
        } else if (data?.image) {
          results[i] = { ...results[i], status: 'success', image: data.image };
          console.log(`[Batch] Success on image ${i + 1}`);
        } else {
          results[i] = { ...results[i], status: 'error', error: 'No image returned' };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        results[i] = { ...results[i], status: 'error', error: message };
        console.error(`[Batch] Exception on image ${i + 1}:`, err);
      }

      completed++;
      setState(prev => ({
        ...prev,
        images: [...results],
        progress: (completed / prompts.length) * 100,
      }));

      // Small delay between requests to avoid rate limiting
      if (i < prompts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failCount = results.filter(r => r.status === 'error').length;

    if (successCount > 0) {
      toast.success(`Generated ${successCount} image${successCount > 1 ? 's' : ''} successfully!`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} image${failCount > 1 ? 's' : ''} failed to generate`);
    }

    setState(prev => ({
      ...prev,
      isGenerating: false,
      progress: 100,
    }));

    return results;
  }, []);

  const resetBatch = useCallback(() => {
    setState({
      images: [],
      isGenerating: false,
      progress: 0,
      totalCost: 0,
    });
  }, []);

  const removeImage = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      images: prev.images.filter(img => img.id !== id),
    }));
  }, []);

  return {
    ...state,
    generateBatch,
    resetBatch,
    removeImage,
    estimatedCost: (count: number) => (count * COST_PER_IMAGE).toFixed(3),
  };
}
