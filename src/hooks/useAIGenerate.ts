import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface GenerateState {
  isGenerating: boolean;
  image: string | null;
  error: string | null;
}

export function useAIGenerate() {
  const [state, setState] = useState<GenerateState>({
    isGenerating: false,
    image: null,
    error: null,
  });

  const generateImage = useCallback(async (prompt: string, stylePrompt: string): Promise<string | null> => {
    setState({ isGenerating: true, image: null, error: null });

    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, style: stylePrompt },
      });

      if (error) {
        console.error('Generate image error:', error);
        setState({ isGenerating: false, image: null, error: error.message });
        return null;
      }

      if (data?.image) {
        setState({ isGenerating: false, image: data.image, error: null });
        return data.image;
      }

      setState({ isGenerating: false, image: null, error: 'No image returned' });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      console.error('Generate image exception:', err);
      setState({ isGenerating: false, image: null, error: message });
      return null;
    }
  }, []);

  const resetState = useCallback(() => {
    setState({ isGenerating: false, image: null, error: null });
  }, []);

  return {
    ...state,
    generateImage,
    resetState,
  };
}
