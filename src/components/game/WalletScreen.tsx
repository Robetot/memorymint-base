import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertCircle, Check } from 'lucide-react';
import { useWallet, WalletType } from '@/hooks/useWallet';

interface WalletScreenProps {
  onBack: () => void;
  onConnected: () => void;
}

export function WalletScreen({ onBack, onConnected }: WalletScreenProps) {
  const { 
    isConnected, 
    isConnecting, 
    address, 
    error, 
    isCorrectChain,
    connectWallet, 
    formatAddress,
    switchToBase 
  } = useWallet();

  const handleConnect = async (type: WalletType) => {
    const success = await connectWallet(type);
    if (success) {
      onConnected();
    }
  };

  const handleSwitchNetwork = async () => {
    const success = await switchToBase();
    if (success && isConnected) {
      onConnected();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background via-muted to-background">
      {/* Back button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="absolute top-6 left-6 rounded-full"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>

      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent mb-4">
          Connect Wallet
        </h1>
        <p className="text-muted-foreground font-body max-w-md mx-auto">
          Connect your wallet to play MemoryMint on Base and mint your skill-based NFTs
        </p>
      </div>

      {/* Connected State */}
      {isConnected && address && (
        <Card className="w-full max-w-md mb-6 border-success bg-success/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Check className="w-5 h-5 text-success" />
            <div className="flex-1">
              <p className="font-body text-sm text-muted-foreground">Connected</p>
              <p className="font-mono text-foreground">{formatAddress(address)}</p>
            </div>
            {!isCorrectChain && (
              <Button size="sm" onClick={handleSwitchNetwork} variant="outline">
                Switch to Base
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="w-full max-w-md mb-6 border-destructive bg-destructive/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Wallet Options */}
      <div className="grid gap-4 w-full max-w-md">
        {/* MetaMask */}
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02] group"
          onClick={() => !isConnecting && handleConnect('metamask')}
        >
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 rounded-xl bg-[#F6851B]/10 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-8 h-8">
                <path fill="#E4761B" d="M38.17 3.44l-15 11.16 2.78-6.56z"/>
                <path fill="#E4761B" d="M1.83 3.44l14.87 11.27-2.65-6.67zM32.68 27.78l-4 6.11 8.54 2.35 2.45-8.32zM.33 27.92l2.44 8.32 8.54-2.35-4-6.11z"/>
                <path fill="#E4761B" d="M10.91 17.33l-2.38 3.6 8.48.38-.3-9.12zM29.09 17.33l-5.91-5.25-.2 9.23 8.48-.38zM11.31 33.89l5.1-2.49-4.4-3.44zM23.59 31.4l5.1 2.49-.7-5.93z"/>
                <path fill="#D7C1B3" d="M28.69 33.89l-5.1-2.49.41 3.32-.04 1.4zM11.31 33.89l4.73 2.23-.04-1.4.41-3.32z"/>
                <path fill="#233447" d="M16.16 25.51l-4.24-1.25 3-1.37zM23.84 25.51l1.24-2.62 3.01 1.37z"/>
                <path fill="#CD6116" d="M11.31 33.89l.73-6.11-4.73.14zM27.96 27.78l.73 6.11 4-5.97zM31.47 20.93l-8.48.38.79 4.2 1.24-2.62 3.01 1.37zM11.92 24.26l3.01-1.37 1.24 2.62.79-4.2-8.48-.38z"/>
                <path fill="#E4751F" d="M8.48 20.93l3.53 6.89-.12-3.56zM28.09 24.26l-.13 3.56 3.51-6.89zM16.96 21.31l-.79 4.2 1 5.12.22-6.75zM23.01 21.31l-.42 2.56.22 6.76 1-5.12z"/>
                <path fill="#F6851B" d="M23.84 25.51l-1 5.12-.71.5 4.4 3.44.73-5.93zM11.92 24.26l.7 5.93 4.4-3.44-.71-.5-1-5.12z"/>
                <path fill="#C0AD9E" d="M23.89 36.12l.04-1.4-.38-.33h-5.7l-.38.33.04 1.4-4.73-2.23 1.65 1.35 3.36 2.33h5.8l3.36-2.33 1.65-1.35z"/>
                <path fill="#161616" d="M23.59 31.4l.71-.5-1-5.12-.79 4.2-3.1 1.87h3.47l.71-.45zM16.41 31.4l-.71-.5 1-5.12.79 4.2 3.1 1.87h-3.47l-.71-.45z"/>
                <path fill="#763D16" d="M38.57 14.6l1.27-6.12L37.56 3l-13.97 10.37 5.38 4.55 7.59 2.21 1.67-1.96-.73-.53 1.16-1.05-.89-.69 1.16-.88zM.16 8.48L1.43 14.6l-.73.55 1.16.88-.89.69 1.16 1.05-.73.53 1.67 1.96 7.59-2.21 5.38-4.55L2.44 3z"/>
                <path fill="#F6851B" d="M36.56 20.13l-7.59-2.21 2.3 3.46-3.42 6.66 4.53-.06h6.75zM10.91 17.33l-7.59 2.21-2.53 8.38h6.75l4.53.06-3.42-6.66zM23.01 21.31l.49-8.48 2.21-5.98h-9.8l2.21 5.98.49 8.48.18 2.67.01 6.65h3.83l.01-6.65z"/>
              </svg>
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">MetaMask</CardTitle>
              <CardDescription className="font-body">Connect with MetaMask wallet</CardDescription>
            </div>
            {isConnecting && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </CardHeader>
        </Card>

        {/* Coinbase Wallet */}
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02] group"
          onClick={() => !isConnecting && handleConnect('coinbase')}
        >
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-12 h-12 rounded-xl bg-[#0052FF]/10 flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-8 h-8">
                <circle cx="20" cy="20" r="20" fill="#0052FF"/>
                <path fill="white" d="M20 6a14 14 0 100 28 14 14 0 000-28zm-4.5 18.5a1 1 0 01-1-1v-7a1 1 0 011-1h9a1 1 0 011 1v7a1 1 0 01-1 1h-9z"/>
              </svg>
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">Coinbase Wallet</CardTitle>
              <CardDescription className="font-body">Connect with Coinbase Wallet</CardDescription>
            </div>
            {isConnecting && (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            )}
          </CardHeader>
        </Card>
      </div>

      {/* Base Network Info */}
      <div className="mt-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-card/50 rounded-full border border-border">
          <div className="w-6 h-6 rounded-full bg-[#0052FF] flex items-center justify-center">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <span className="text-sm text-muted-foreground font-body">Powered by Base Network</span>
        </div>
      </div>
    </div>
  );
}
