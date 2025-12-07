import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IPFSUploadState {
  isUploading: boolean;
  tokenURI: string | null;
  cid: string | null;
  error: string | null;
}

interface NFTMetadata {
  name: string;
  description: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export function useIPFSUpload() {
  const [state, setState] = useState<IPFSUploadState>({
    isUploading: false,
    tokenURI: null,
    cid: null,
    error: null,
  });

  const uploadToIPFS = useCallback(async (
    imageData: string,
    metadata: NFTMetadata
  ): Promise<{ tokenURI: string; cid: string } | null> => {
    setState({ isUploading: true, tokenURI: null, cid: null, error: null });

    try {
      const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
        body: { imageData, metadata },
      });

      if (error) {
        console.error('IPFS upload error:', error);
        setState({ isUploading: false, tokenURI: null, cid: null, error: error.message });
        return null;
      }

      if (data?.tokenURI && data?.cid) {
        setState({ 
          isUploading: false, 
          tokenURI: data.tokenURI, 
          cid: data.cid, 
          error: null 
        });
        return { tokenURI: data.tokenURI, cid: data.cid };
      }

      setState({ isUploading: false, tokenURI: null, cid: null, error: 'Upload failed' });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('IPFS upload exception:', err);
      setState({ isUploading: false, tokenURI: null, cid: null, error: message });
      return null;
    }
  }, []);

  const resetState = useCallback(() => {
    setState({ isUploading: false, tokenURI: null, cid: null, error: null });
  }, []);

  return {
    ...state,
    uploadToIPFS,
    resetState,
  };
}
