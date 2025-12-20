import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface IPFSUploadState {
  isUploading: boolean;
  tokenURI: string | null;
  cid: string | null;
  imageGatewayUrl: string | null;
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

export interface IPFSUploadResult {
  tokenURI: string;
  cid: string;
  imageGatewayUrl?: string;
  imageUrl?: string;
}

export function useIPFSUpload() {
  const [state, setState] = useState<IPFSUploadState>({
    isUploading: false,
    tokenURI: null,
    cid: null,
    imageGatewayUrl: null,
    error: null,
  });

  const uploadToIPFS = useCallback(
    async (imageData: string, metadata: NFTMetadata): Promise<IPFSUploadResult | null> => {
      setState({ isUploading: true, tokenURI: null, cid: null, imageGatewayUrl: null, error: null });

      try {
        const { data, error } = await supabase.functions.invoke('upload-to-ipfs', {
          body: { imageData, metadata },
        });

        if (error) {
          console.error('IPFS upload error:', error);
          setState({ isUploading: false, tokenURI: null, cid: null, imageGatewayUrl: null, error: error.message });
          return null;
        }

        if (data?.tokenURI && data?.cid) {
          setState({
            isUploading: false,
            tokenURI: data.tokenURI,
            cid: data.cid,
            imageGatewayUrl: data.imageGatewayUrl ?? null,
            error: null,
          });

          return {
            tokenURI: data.tokenURI,
            cid: data.cid,
            imageGatewayUrl: data.imageGatewayUrl,
            imageUrl: data.imageUrl,
          };
        }

        setState({ isUploading: false, tokenURI: null, cid: null, imageGatewayUrl: null, error: 'Upload failed' });
        return null;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        console.error('IPFS upload exception:', err);
        setState({ isUploading: false, tokenURI: null, cid: null, imageGatewayUrl: null, error: message });
        return null;
      }
    },
    []
  );

  const resetState = useCallback(() => {
    setState({ isUploading: false, tokenURI: null, cid: null, imageGatewayUrl: null, error: null });
  }, []);

  return {
    ...state,
    uploadToIPFS,
    resetState,
  };
}

