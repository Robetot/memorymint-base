import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IPFSUploadState {
  isUploading: boolean;
  tokenURI: string | null;
  cid: string | null;
  imageGatewayUrl: string | null;
  error: string | null;
  attempt: number;
  maxAttempts: number;
}

interface NFTMetadata {
  name: string;
  description: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface IPFSUploadResult {
  tokenURI: string;
  cid: string;
  imageGatewayUrl?: string;
  imageUrl?: string;
}

const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 2000, 4000]; // Exponential backoff

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Translates technical errors into user-friendly messages.
 * We hide non-2xx, RPC, and infra errors from users.
 */
function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  // Hide technical infrastructure errors
  if (message.includes('non-2xx') || message.includes('Edge Function')) {
    return 'Network temporarily unstable. Please retry.';
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection issue. Please check your network and retry.';
  }
  if (message.includes('rate limit') || message.includes('429')) {
    return 'Service busy. Please wait a moment and retry.';
  }
  if (message.includes('timeout') || message.includes('Timeout')) {
    return 'Upload timed out. Please retry.';
  }
  if (message.includes('Pinata') || message.includes('IPFS')) {
    return 'Storage service unavailable. Please retry.';
  }
  
  // Generic fallback - still friendly
  return 'Upload failed. Please retry.';
}

export function useIPFSUpload() {
  const [state, setState] = useState<IPFSUploadState>({
    isUploading: false,
    tokenURI: null,
    cid: null,
    imageGatewayUrl: null,
    error: null,
    attempt: 0,
    maxAttempts: MAX_UPLOAD_ATTEMPTS,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Single upload attempt to IPFS
   */
  const attemptUpload = useCallback(
    async (imageData: string, metadata: NFTMetadata): Promise<IPFSUploadResult | null> => {
      const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
        body: { imageData, metadata },
      });

      if (error) {
        console.warn('[IPFS] Upload attempt failed:', error);
        throw error;
      }

      if (data?.tokenURI && data?.cid) {
        return {
          tokenURI: data.tokenURI,
          cid: data.cid,
          imageGatewayUrl: data.imageGatewayUrl,
          imageUrl: data.imageUrl,
        };
      }

      throw new Error('Invalid response from upload');
    },
    []
  );

  /**
   * Upload with automatic retry (3 attempts with exponential backoff)
   * Returns null if all attempts fail - caller decides what to do
   */
  const uploadToIPFS = useCallback(
    async (imageData: string, metadata: NFTMetadata): Promise<IPFSUploadResult | null> => {
      // Cancel any previous upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      setState(prev => ({ 
        ...prev, 
        isUploading: true, 
        tokenURI: null, 
        cid: null, 
        imageGatewayUrl: null, 
        error: null,
        attempt: 0 
      }));

      let lastError: unknown = null;

      for (let i = 0; i < MAX_UPLOAD_ATTEMPTS; i++) {
        // Check if upload was cancelled
        if (abortControllerRef.current?.signal.aborted) {
          setState(prev => ({ ...prev, isUploading: false }));
          return null;
        }
        
        setState(prev => ({ ...prev, attempt: i + 1 }));
        
        try {
          // Apply retry delay (skip first attempt)
          if (i > 0) {
            console.log(`[IPFS] Retry attempt ${i + 1}/${MAX_UPLOAD_ATTEMPTS} after ${RETRY_DELAYS[i]}ms`);
            await sleep(RETRY_DELAYS[i]);
          }

          const result = await attemptUpload(imageData, metadata);
          
          if (result) {
            console.log(`[IPFS] Upload succeeded on attempt ${i + 1}`);
            setState({
              isUploading: false,
              tokenURI: result.tokenURI,
              cid: result.cid,
              imageGatewayUrl: result.imageGatewayUrl ?? null,
              error: null,
              attempt: i + 1,
              maxAttempts: MAX_UPLOAD_ATTEMPTS,
            });
            return result;
          }
        } catch (err) {
          lastError = err;
          console.warn(`[IPFS] Attempt ${i + 1}/${MAX_UPLOAD_ATTEMPTS} failed:`, err);
        }
      }

      // All attempts failed
      const friendlyError = getUserFriendlyError(lastError);
      console.error('[IPFS] All upload attempts failed:', lastError);
      
      setState({
        isUploading: false,
        tokenURI: null,
        cid: null,
        imageGatewayUrl: null,
        error: friendlyError,
        attempt: MAX_UPLOAD_ATTEMPTS,
        maxAttempts: MAX_UPLOAD_ATTEMPTS,
      });
      
      return null;
    },
    [attemptUpload]
  );

  const resetState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      isUploading: false,
      tokenURI: null,
      cid: null,
      imageGatewayUrl: null,
      error: null,
      attempt: 0,
      maxAttempts: MAX_UPLOAD_ATTEMPTS,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    uploadToIPFS,
    resetState,
    clearError,
  };
}
