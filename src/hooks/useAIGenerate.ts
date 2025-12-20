import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GenerateState {
  isGenerating: boolean;
  image: string | null;
  error: string | null;
  errorCode: string | null;
}

// Error messages for specific error codes
const ERROR_MESSAGES: Record<string, string> = {
  payment_required: 'AI credits exhausted. Please try again later or contact the app owner.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  auth_failed: 'AI service is temporarily unavailable. Please try again later.',
  generation_failed: 'Failed to generate image. Please try a different prompt.',
};

export function useAIGenerate() {
  const [state, setState] = useState<GenerateState>({
    isGenerating: false,
    image: null,
    error: null,
    errorCode: null,
  });

  const generateImage = useCallback(async (prompt: string, stylePrompt: string): Promise<string | null> => {
    setState({ isGenerating: true, image: null, error: null, errorCode: null });

    try {
      console.log('[AI Generate] Starting image generation...');
      
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt, style: stylePrompt },
      });

      if (error) {
        console.error('[AI Generate] Supabase function error:', error);
        
        // Try to extract more specific error from the response
        let errorMessage = error.message || 'Image generation failed';
        let errorCode = 'unknown';
        
        // Check if the error message contains JSON with more details
        if (error.message?.includes('non-2xx')) {
          errorMessage = 'Image generation service is temporarily unavailable. Please try again later.';
          errorCode = 'service_unavailable';
        }
        
        // Show toast for user feedback
        toast.error(errorMessage);
        
        setState({ 
          isGenerating: false, 
          image: null, 
          error: errorMessage,
          errorCode 
        });
        return null;
      }

      // Check for error in response body
      if (data?.error) {
        const errorCode = data.code || 'generation_failed';
        const errorMessage = ERROR_MESSAGES[errorCode] || data.error;
        
        console.error('[AI Generate] API returned error:', data.error, 'code:', errorCode);
        toast.error(errorMessage);
        
        setState({ 
          isGenerating: false, 
          image: null, 
          error: errorMessage,
          errorCode
        });
        return null;
      }

      if (data?.image) {
        console.log('[AI Generate] Image generated successfully');
        setState({ isGenerating: false, image: data.image, error: null, errorCode: null });
        return data.image;
      }

      const fallbackError = 'No image was generated. Please try again with a different prompt.';
      toast.error(fallbackError);
      setState({ isGenerating: false, image: null, error: fallbackError, errorCode: 'no_image' });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed unexpectedly';
      console.error('[AI Generate] Exception:', err);
      
      // Provide user-friendly message
      const userMessage = message.includes('network') 
        ? 'Network error. Please check your connection and try again.'
        : 'Image generation failed. Please try again.';
      
      toast.error(userMessage);
      setState({ isGenerating: false, image: null, error: userMessage, errorCode: 'exception' });
      return null;
    }
  }, []);

  const resetState = useCallback(() => {
    setState({ isGenerating: false, image: null, error: null, errorCode: null });
  }, []);

  return {
    ...state,
    generateImage,
    resetState,
  };
}
