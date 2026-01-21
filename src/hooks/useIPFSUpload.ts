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
  usedFallback: boolean;
  providerUsed: string;
  errorCode: string | null;
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
  usedFallback?: boolean;
}

const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 2000, 4000]; // Exponential backoff

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Translates error codes into user-friendly messages.
 * Never expose technical infrastructure errors to users.
 */
function getUserFriendlyError(errorCode: string | null, rawMessage?: string): string {
  switch (errorCode) {
    case 'RATE_LIMITED':
    case 'PROVIDER_RATE_LIMITED':
      return 'Service busy. Please wait a moment and retry.';
    case 'CONFIG_ERROR':
      return 'Service temporarily unavailable. Please retry.';
    case 'INVALID_INPUT':
    case 'INVALID_METADATA':
      return 'Invalid image data. Please try a different image.';
    case 'SIZE_EXCEEDED':
      return 'Image too large. Please use a smaller image.';
    case 'UPLOAD_FAILED':
    case 'PARTIAL_UPLOAD':
      return 'Upload failed. Please retry.';
    case 'UNEXPECTED_ERROR':
      return 'Network temporarily unstable. Please retry.';
    default:
      break;
  }
  
  // Legacy fallback for raw messages
  const message = rawMessage || '';
  
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
  
  return 'Upload failed. Please retry.';
}

/**
 * Generate a placeholder data URI for emergency fallback minting.
 * This ensures minting can proceed even if IPFS is completely unavailable.
 */
function generatePlaceholderDataURI(metadata: NFTMetadata): string {
  const placeholderMetadata = {
    name: metadata.name,
    description: `${metadata.description} [Metadata pending - will be updated]`,
    image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjEwMCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNmZmYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk1lbW9yeU1pbnQ8L3RleHQ+PC9zdmc+',
    external_url: 'https://memorymint.app',
    attributes: [
      ...metadata.attributes,
      { trait_type: 'Metadata Status', value: 'Pending' },
    ],
  };
  
  const jsonString = JSON.stringify(placeholderMetadata);
  const base64 = btoa(unescape(encodeURIComponent(jsonString)));
  return `data:application/json;base64,${base64}`;
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
    usedFallback: false,
    providerUsed: 'none',
    errorCode: null,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Single upload attempt to IPFS via Edge Function
   */
  const attemptUpload = useCallback(
    async (imageData: string, metadata: NFTMetadata): Promise<{ 
      result: IPFSUploadResult | null; 
      errorCode?: string;
      error?: string;
    }> => {
      const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
        body: { imageData, metadata },
      });

      // Edge function network error
      if (error) {
        console.warn('[IPFS] Edge function error:', error);
        return { result: null, errorCode: 'EDGE_ERROR', error: error.message };
      }

      // Check for fail-open response (success: false but HTTP 200)
      if (data && data.success === false) {
        console.warn('[IPFS] Upload returned failure:', data.errorCode, data.error);
        return { 
          result: null, 
          errorCode: data.errorCode || 'UPLOAD_FAILED',
          error: data.error
        };
      }

      // Success
      if (data?.tokenURI && data?.cid) {
        return {
          result: {
            tokenURI: data.tokenURI,
            cid: data.cid,
            imageGatewayUrl: data.imageGatewayUrl,
            imageUrl: data.imageUrl,
          }
        };
      }

      return { result: null, errorCode: 'INVALID_RESPONSE', error: 'Invalid response from upload' };
    },
    []
  );

  /**
   * Upload with automatic retry (3 attempts with exponential backoff)
   * Returns null if all attempts fail - caller decides what to do
   * 
   * Options:
   * - allowPlaceholder: if true, returns a placeholder data URI when all attempts fail
   */
  const uploadToIPFS = useCallback(
    async (
      imageData: string, 
      metadata: NFTMetadata,
      options?: { allowPlaceholder?: boolean }
    ): Promise<IPFSUploadResult | null> => {
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
        errorCode: null,
        attempt: 0,
        usedFallback: false,
        providerUsed: 'pinata',
      }));

      let lastErrorCode: string | null = null;
      let lastError: string | undefined;

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

          const { result, errorCode, error } = await attemptUpload(imageData, metadata);
          
          if (result) {
            console.log(`[IPFS] Upload succeeded on attempt ${i + 1}`);
            setState({
              isUploading: false,
              tokenURI: result.tokenURI,
              cid: result.cid,
              imageGatewayUrl: result.imageGatewayUrl ?? null,
              error: null,
              errorCode: null,
              attempt: i + 1,
              maxAttempts: MAX_UPLOAD_ATTEMPTS,
              usedFallback: false,
              providerUsed: 'pinata',
            });
            return result;
          }
          
          lastErrorCode = errorCode || null;
          lastError = error;
          
          // Don't retry on certain error codes
          if (errorCode === 'INVALID_INPUT' || errorCode === 'SIZE_EXCEEDED' || errorCode === 'INVALID_METADATA') {
            break;
          }
          
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(`[IPFS] Attempt ${i + 1}/${MAX_UPLOAD_ATTEMPTS} failed:`, err);
        }
      }

      // All attempts failed
      const friendlyError = getUserFriendlyError(lastErrorCode, lastError);
      console.error('[IPFS] All upload attempts failed:', lastErrorCode, lastError);
      
      // If allowPlaceholder, return placeholder instead of null
      if (options?.allowPlaceholder) {
        console.log('[IPFS] Returning placeholder for fail-open minting');
        const placeholderURI = generatePlaceholderDataURI(metadata);
        
        setState({
          isUploading: false,
          tokenURI: placeholderURI,
          cid: null,
          imageGatewayUrl: null,
          error: friendlyError,
          errorCode: lastErrorCode,
          attempt: MAX_UPLOAD_ATTEMPTS,
          maxAttempts: MAX_UPLOAD_ATTEMPTS,
          usedFallback: true,
          providerUsed: 'placeholder',
        });
        
        return {
          tokenURI: placeholderURI,
          cid: 'placeholder',
          usedFallback: true,
        };
      }
      
      setState({
        isUploading: false,
        tokenURI: null,
        cid: null,
        imageGatewayUrl: null,
        error: friendlyError,
        errorCode: lastErrorCode,
        attempt: MAX_UPLOAD_ATTEMPTS,
        maxAttempts: MAX_UPLOAD_ATTEMPTS,
        usedFallback: false,
        providerUsed: 'none',
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
      errorCode: null,
      attempt: 0,
      maxAttempts: MAX_UPLOAD_ATTEMPTS,
      usedFallback: false,
      providerUsed: 'none',
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, errorCode: null }));
  }, []);

  return {
    ...state,
    uploadToIPFS,
    resetState,
    clearError,
    generatePlaceholderDataURI,
  };
}
