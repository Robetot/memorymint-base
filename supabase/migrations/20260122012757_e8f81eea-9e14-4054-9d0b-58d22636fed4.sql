-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create RPC health tracking table for circuit breaker logic
CREATE TABLE public.rpc_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failed', 'circuit_open')),
  priority INTEGER NOT NULL DEFAULT 0,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC,
  p95_response_time_ms NUMERIC,
  total_calls INTEGER NOT NULL DEFAULT 0,
  successful_calls INTEGER NOT NULL DEFAULT 0,
  failed_calls INTEGER NOT NULL DEFAULT 0,
  last_success TIMESTAMP WITH TIME ZONE,
  last_failure TIMESTAMP WITH TIME ZONE,
  circuit_breaker_opened_at TIMESTAMP WITH TIME ZONE,
  circuit_breaker_attempts INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contract state snapshots table for versioning
CREATE TABLE public.contract_state_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_type TEXT NOT NULL DEFAULT 'manual',
  version INTEGER NOT NULL DEFAULT 1,
  state JSONB NOT NULL,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  requested_by TEXT,
  rpc_endpoint_used TEXT,
  fetch_duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_rpc_health_status ON public.rpc_health(status);
CREATE INDEX idx_rpc_health_priority ON public.rpc_health(priority DESC);
CREATE INDEX idx_snapshots_type ON public.contract_state_snapshots(snapshot_type);
CREATE INDEX idx_snapshots_created ON public.contract_state_snapshots(created_at DESC);

-- Enable RLS
ALTER TABLE public.rpc_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_state_snapshots ENABLE ROW LEVEL SECURITY;

-- RPC health: readable by all, writable by service role only (edge functions)
CREATE POLICY "RPC health is readable by all" 
ON public.rpc_health FOR SELECT USING (true);

-- Snapshots: readable by all, writable by service role only
CREATE POLICY "Snapshots are readable by all" 
ON public.contract_state_snapshots FOR SELECT USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_rpc_health_updated_at
BEFORE UPDATE ON public.rpc_health
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial RPC endpoints
INSERT INTO public.rpc_health (endpoint, priority, status) VALUES
  ('https://mainnet.base.org', 10, 'healthy'),
  ('https://base.publicnode.com', 9, 'healthy'),
  ('https://base.gateway.tenderly.co', 8, 'healthy'),
  ('https://base.llamarpc.com', 7, 'healthy'),
  ('https://base.drpc.org', 6, 'healthy'),
  ('https://1rpc.io/base', 5, 'healthy'),
  ('https://base-mainnet.public.blastapi.io', 4, 'healthy'),
  ('https://base.meowrpc.com', 3, 'healthy')
ON CONFLICT (endpoint) DO NOTHING;