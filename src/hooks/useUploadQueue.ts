import { useState, useCallback, useEffect, useRef } from 'react';

interface PendingUpload {
  id: string;
  tokenId?: string;
  imageData: string;
  metadata: {
    name: string;
    description: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
  };
  status: 'pending' | 'retrying' | 'resolved' | 'failed';
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  resolvedTokenURI?: string;
  error?: string;
}

interface UploadQueueState {
  pendingUploads: PendingUpload[];
  isProcessing: boolean;
  lastProcessed?: string;
}

const STORAGE_KEY = 'memorymint_pending_uploads';
const RETRY_INTERVAL_MS = 15000; // 15 seconds
const MAX_QUEUE_ATTEMPTS = 10;

/**
 * Background upload queue for failed IPFS uploads.
 * Stores pending uploads in localStorage and retries periodically.
 */
export function useUploadQueue(uploadFn: (imageData: string, metadata: PendingUpload['metadata']) => Promise<{ tokenURI: string } | null>) {
  const [state, setState] = useState<UploadQueueState>({
    pendingUploads: [],
    isProcessing: false,
  });
  
  const processingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PendingUpload[];
        // Filter out very old entries (>24 hours)
        const filtered = parsed.filter(p => 
          Date.now() - p.createdAt < 24 * 60 * 60 * 1000 &&
          p.status !== 'resolved'
        );
        setState(prev => ({ ...prev, pendingUploads: filtered }));
      }
    } catch (e) {
      console.warn('[UploadQueue] Failed to load from localStorage:', e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingUploads));
    } catch (e) {
      console.warn('[UploadQueue] Failed to save to localStorage:', e);
    }
  }, [state.pendingUploads]);

  // Add to queue
  const addToQueue = useCallback((
    imageData: string,
    metadata: PendingUpload['metadata'],
    tokenId?: string
  ): string => {
    const id = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const newUpload: PendingUpload = {
      id,
      tokenId,
      imageData,
      metadata,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_QUEUE_ATTEMPTS,
      createdAt: Date.now(),
    };
    
    setState(prev => ({
      ...prev,
      pendingUploads: [...prev.pendingUploads, newUpload],
    }));
    
    console.log('[UploadQueue] Added to queue:', id);
    return id;
  }, []);

  // Remove from queue
  const removeFromQueue = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      pendingUploads: prev.pendingUploads.filter(u => u.id !== id),
    }));
  }, []);

  // Mark as resolved
  const markResolved = useCallback((id: string, tokenURI: string) => {
    setState(prev => ({
      ...prev,
      pendingUploads: prev.pendingUploads.map(u => 
        u.id === id ? { ...u, status: 'resolved' as const, resolvedTokenURI: tokenURI } : u
      ),
      lastProcessed: id,
    }));
  }, []);

  // Process single upload
  const processUpload = useCallback(async (upload: PendingUpload): Promise<boolean> => {
    setState(prev => ({
      ...prev,
      pendingUploads: prev.pendingUploads.map(u =>
        u.id === upload.id ? { ...u, status: 'retrying' as const, attempts: u.attempts + 1, lastAttemptAt: Date.now() } : u
      ),
    }));

    try {
      const result = await uploadFn(upload.imageData, upload.metadata);
      
      if (result?.tokenURI) {
        console.log('[UploadQueue] Upload succeeded:', upload.id);
        markResolved(upload.id, result.tokenURI);
        return true;
      }
    } catch (e) {
      console.warn('[UploadQueue] Upload attempt failed:', upload.id, e);
    }

    // Update status based on attempts
    setState(prev => ({
      ...prev,
      pendingUploads: prev.pendingUploads.map(u => {
        if (u.id !== upload.id) return u;
        const newAttempts = u.attempts;
        if (newAttempts >= u.maxAttempts) {
          return { ...u, status: 'failed' as const, error: 'Max retries exceeded' };
        }
        return { ...u, status: 'pending' as const };
      }),
    }));

    return false;
  }, [uploadFn, markResolved]);

  // Process queue
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    
    processingRef.current = true;
    setState(prev => ({ ...prev, isProcessing: true }));

    const pending = state.pendingUploads.filter(u => 
      u.status === 'pending' && 
      u.attempts < u.maxAttempts
    );

    for (const upload of pending) {
      await processUpload(upload);
      // Small delay between uploads
      await new Promise(r => setTimeout(r, 1000));
    }

    processingRef.current = false;
    setState(prev => ({ ...prev, isProcessing: false }));
  }, [state.pendingUploads, processUpload]);

  // Auto-process queue periodically
  useEffect(() => {
    const hasPending = state.pendingUploads.some(u => 
      u.status === 'pending' && u.attempts < u.maxAttempts
    );

    if (hasPending && !intervalRef.current) {
      // Initial delay then periodic
      const timeout = setTimeout(() => {
        processQueue();
        intervalRef.current = setInterval(processQueue, RETRY_INTERVAL_MS);
      }, 5000);

      return () => {
        clearTimeout(timeout);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else if (!hasPending && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [state.pendingUploads, processQueue]);

  // Manual retry
  const retryUpload = useCallback(async (id: string) => {
    const upload = state.pendingUploads.find(u => u.id === id);
    if (!upload) return false;
    return processUpload(upload);
  }, [state.pendingUploads, processUpload]);

  // Clear all failed
  const clearFailed = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingUploads: prev.pendingUploads.filter(u => u.status !== 'failed'),
    }));
  }, []);

  return {
    pendingUploads: state.pendingUploads,
    isProcessing: state.isProcessing,
    hasPending: state.pendingUploads.some(u => u.status === 'pending'),
    addToQueue,
    removeFromQueue,
    retryUpload,
    processQueue,
    clearFailed,
  };
}
