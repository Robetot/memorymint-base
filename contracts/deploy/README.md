# MemoryMintPro Deployment Guide

## Overview

MemoryMintPro is a gas-optimized ERC-721 NFT contract designed for the MemoryMint game on Base Mainnet. It features free public minting, Farcaster integration, and batch minting support.

## Features

- ✅ **Free Public Minting** - Only gas cost, no ETH required
- ✅ **Gas Optimized** - Packed structs, minimal storage writes, unchecked math
- ✅ **Batch Minting** - Up to 10 NFTs per transaction
- ✅ **Player Registration** - One-time name submission with Farcaster FID
- ✅ **Game Metadata** - Level, rarity, score, combos stored on-chain
- ✅ **Reentrancy Protection** - Secure against reentrancy attacks
- ✅ **ERC-4906 Support** - Metadata update events for marketplaces

## Prerequisites

### 1. Install Foundry

```bash
# Windows (PowerShell)
irm https://foundry.paradigm.xyz | iex

# macOS/Linux
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### 2. Get ETH on Base Mainnet

You need a small amount of ETH on Base for deployment gas (~0.001 ETH).

- Bridge from Ethereum: https://bridge.base.org
- Buy directly: https://www.coinbase.com

### 3. Get Basescan API Key (Optional, for verification)

1. Go to https://basescan.org/register
2. Create account and verify email
3. Go to API Keys section
4. Create new API key

## Deployment Methods

### Method 1: PowerShell Script (Recommended for Windows)

```powershell
# Using private key
.\Deploy-MemoryMintPro.ps1 -AuthMethod "privatekey" -PrivateKey "0xYOUR_PRIVATE_KEY"

# Using mnemonic
.\Deploy-MemoryMintPro.ps1 -AuthMethod "mnemonic" -Mnemonic "word1 word2 word3..."

# Using keystore
.\Deploy-MemoryMintPro.ps1 -AuthMethod "keystore" -KeystorePath "./keystore.json"

# With verification
.\Deploy-MemoryMintPro.ps1 -AuthMethod "privatekey" -PrivateKey "0x..." -Verify -BasescanApiKey "YOUR_KEY"

# Dry run (test without deploying)
.\Deploy-MemoryMintPro.ps1 -AuthMethod "privatekey" -PrivateKey "0x..." -DryRun
```

#### Script Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `-AuthMethod` | Authentication: `privatekey`, `mnemonic`, `keystore` | Required |
| `-PrivateKey` | Private key (with or without 0x) | - |
| `-Mnemonic` | 12/24 word mnemonic phrase | - |
| `-KeystorePath` | Path to keystore JSON file | - |
| `-KeystorePassword` | Keystore password | - |
| `-Name` | NFT collection name | "MemoryMint" |
| `-Symbol` | NFT collection symbol | "MMINT" |
| `-BaseURI` | Base URI for metadata | "ipfs://" |
| `-RpcUrl` | Base RPC endpoint | "https://mainnet.base.org" |
| `-Verify` | Verify on Basescan | false |
| `-BasescanApiKey` | Basescan API key | - |
| `-DryRun` | Test without deploying | false |

### Method 2: Remix IDE (Recommended for Beginners)

1. **Open Remix**: https://remix.ethereum.org

2. **Create Contract File**:
   - Click "File Explorer" → "contracts" folder
   - Create new file: `MemoryMintPro.sol`
   - Copy contract code from `contracts/MemoryMintPro.sol`

3. **Compile**:
   - Go to "Solidity Compiler" tab
   - Select compiler version: `0.8.20`
   - Enable optimization: ✅ (200 runs)
   - Click "Compile MemoryMintPro.sol"

4. **Deploy**:
   - Go to "Deploy & Run Transactions" tab
   - Environment: "Injected Provider - MetaMask"
   - Connect MetaMask to Base Mainnet:
     - Network Name: Base Mainnet
     - RPC URL: https://mainnet.base.org
     - Chain ID: 8453
     - Currency: ETH
     - Explorer: https://basescan.org
   - Constructor args:
     - `_name`: "MemoryMint"
     - `_symbol`: "MMINT"
     - `_baseURI`: "ipfs://"
   - Click "Deploy" and confirm in MetaMask

5. **Verify** (Optional):
   - Go to https://basescan.org/verifyContract
   - Enter contract address
   - Select Solidity 0.8.20, optimization enabled (200 runs)
   - Paste contract source code
   - Enter constructor arguments (ABI-encoded)

### Method 3: Forge CLI (For Developers)

```bash
# Navigate to contracts directory
cd contracts

# Build
forge build

# Deploy with private key
forge create MemoryMintPro.sol:MemoryMintPro \
  --rpc-url https://mainnet.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --constructor-args "MemoryMint" "MMINT" "ipfs://" \
  --optimize --optimizer-runs 200

# Deploy with keystore
forge create MemoryMintPro.sol:MemoryMintPro \
  --rpc-url https://mainnet.base.org \
  --keystore ~/.foundry/keystores/my-key \
  --constructor-args "MemoryMint" "MMINT" "ipfs://" \
  --optimize --optimizer-runs 200

# Deploy and verify
forge create MemoryMintPro.sol:MemoryMintPro \
  --rpc-url https://mainnet.base.org \
  --private-key YOUR_PRIVATE_KEY \
  --constructor-args "MemoryMint" "MMINT" "ipfs://" \
  --verify --etherscan-api-key YOUR_BASESCAN_API_KEY
```

## Gas Estimates

| Function | Estimated Gas | Cost (0.001 Gwei) |
|----------|---------------|-------------------|
| Deploy | ~2,000,000 | ~0.002 ETH |
| mintNFT | ~95,000 | ~0.000095 ETH |
| mintGameNFT | ~120,000 | ~0.00012 ETH |
| batchMint(5) | ~250,000 | ~0.00025 ETH |
| batchMint(10) | ~450,000 | ~0.00045 ETH |
| registerPlayer | ~50,000 | ~0.00005 ETH |

*Base Mainnet has very low gas fees, typically under $0.01 per transaction*

## Contract Functions

### Public Minting (FREE)

```solidity
// Simple mint with IPFS metadata
function mintNFT(string calldata tokenURI_) external returns (uint256)

// Game NFT with full metadata
function mintGameNFT(
    string calldata tokenURI_,
    uint8 level,
    uint8 rarity,
    uint16 score,
    uint32 completionTime,
    uint8 comboStreak,
    bool perfectGame
) external returns (uint256)

// Batch mint (up to 10)
function batchMint(uint256 quantity) external returns (uint256 startTokenId)
```

### Player Registration

```solidity
// Register player name (one-time)
function registerPlayer(string calldata playerName, uint64 farcasterFid) external

// Get player data
function getPlayer(address player) external view returns (
    string memory playerName,
    uint64 farcasterFid,
    uint32 totalMints,
    uint32 firstMintTime,
    bool nameSet
)
```

### Admin Functions

```solidity
function pause() external onlyOwner
function unpause() external onlyOwner
function setThrottle(bool enabled) external onlyOwner
function setBaseURI(string calldata baseURI_) external onlyOwner
function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner
function transferOwnership(address newOwner) external onlyOwner
```

## Frontend Integration

After deployment, update the contract address in your frontend:

```typescript
// src/hooks/useNFTMint.ts
const NFT_CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS";
```

### Minting Example

```typescript
import { supabase } from "@/integrations/supabase/client";

// Simple mint
const { data, error } = await supabase.functions.invoke('mint-nft', {
  body: {
    walletAddress: userWallet,
    tokenURI: "ipfs://QmYourIPFSHash"
  }
});

// Game NFT with metadata
const { data, error } = await supabase.functions.invoke('mint-game-nft', {
  body: {
    walletAddress: userWallet,
    tokenURI: "ipfs://QmYourIPFSHash",
    level: 3,
    rarity: 2,
    score: 1500,
    completionTime: 45,
    comboStreak: 5,
    perfectGame: true
  }
});
```

## Security Considerations

1. **Private Key Security**: Never commit private keys to git
2. **Keystore Files**: Use encrypted keystores for production
3. **Environment Variables**: Store secrets in `.env` files (gitignored)
4. **Reentrancy**: Contract includes reentrancy guards
5. **Overflow**: Uses Solidity 0.8+ with built-in overflow checks
6. **Access Control**: Admin functions restricted to owner

## Troubleshooting

### "Insufficient funds"
- Ensure you have ETH on Base Mainnet (not Base Goerli)
- Bridge ETH from Ethereum: https://bridge.base.org

### "Contract creation code storage out of gas"
- Increase gas limit in deployment command
- Use `--gas-limit 5000000` flag

### "Verification failed"
- Ensure exact same compiler settings
- Check constructor arguments are ABI-encoded correctly
- Wait a few minutes after deployment before verifying

### "Nonce too low"
- Reset MetaMask account (Settings → Advanced → Reset Account)
- Or specify nonce: `--nonce YOUR_NONCE`

## Support

- **Basescan**: https://basescan.org
- **Base Docs**: https://docs.base.org
- **Foundry Book**: https://book.getfoundry.sh
- **Remix Docs**: https://remix-ide.readthedocs.io
