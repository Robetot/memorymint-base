# MemoryMintFeeAware - Remix Deployment Guide

## Quick Start

### Step 1: Upload Files to Remix
1. Go to [Remix IDE](https://remix.ethereum.org)
2. Create a new folder: `contracts`
3. Create two files:
   - `IERC721Receiver.sol` - Copy contents from this folder
   - `MemoryMintFeeAware.sol` - Copy contents from this folder

### Step 2: Compiler Settings
1. Go to **Solidity Compiler** tab (left sidebar)
2. Configure:
   - **Compiler Version**: `0.8.20`
   - **Enable Optimization**: ✅ Checked
   - **Runs**: `200`
   - **EVM Version**: `paris` (or default)

### Step 3: Compile
1. Select `MemoryMintFeeAware.sol` in file explorer
2. Click **Compile MemoryMintFeeAware.sol**
3. Verify: Green checkmark, no errors

### Step 4: Deploy to Base Mainnet
1. Go to **Deploy & Run Transactions** tab
2. **Environment**: Select `Injected Provider - MetaMask`
3. Connect MetaMask to **Base Mainnet** (Chain ID: 8453)
4. Ensure you have ETH for gas (~0.001-0.002 ETH)
5. Select contract: `MemoryMintFeeAware`
6. Enter constructor parameters:
   ```
   name_: "MemoryMint"
   symbol_: "MMINT"
   baseURI_: "ipfs://YOUR_METADATA_CID/"
   ```
7. Click **Deploy**
8. Confirm transaction in MetaMask

### Step 5: Verify on BaseScan (Optional but Recommended)
1. Copy deployed contract address
2. Go to [BaseScan](https://basescan.org)
3. Search for your contract address
4. Click **Contract** → **Verify & Publish**
5. Choose **Multi-file Solidity**
6. Upload both `.sol` files
7. Match compiler settings exactly:
   - Compiler: 0.8.20
   - Optimization: Yes, 200 runs
   - License: MIT

---

## Contract Features

| Feature | Status |
|---------|--------|
| Unlimited Supply | ✅ |
| Free/Paid Mint | ✅ Configurable via `setMintPrice()` |
| One-Transaction Mint | ✅ |
| Safe Mint (Contract Wallets) | ✅ |
| ERC-721 Compliant | ✅ |
| ERC-165 Interface Detection | ✅ |
| ERC-4906 Metadata Updates | ✅ |
| Marketplace Compatible | ✅ OpenSea, Base App |
| Gas Optimized | ✅ ~80k gas per mint |

---

## Post-Deployment Setup

### Set Mint Price (Optional)
```solidity
// Free mint (default)
setMintPrice(0)

// Paid mint (e.g., 0.001 ETH)
setMintPrice(1000000000000000)
```

### Update Base URI
```solidity
setBaseURI("ipfs://NEW_METADATA_CID/")
```

### Withdraw Funds
```solidity
withdraw()
```

---

## Gas Estimates

| Operation | Gas (approx) |
|-----------|-------------|
| Deploy | ~800k-1M |
| mintNFT (EOA) | ~80k |
| mintNFT (Contract) | ~82k |
| transferFrom | ~50k |
| safeTransferFrom | ~55k |

---

## Wallet Compatibility

- ✅ MetaMask (Desktop & Mobile)
- ✅ Base App
- ✅ Farcaster Wallets
- ✅ Coinbase Wallet
- ✅ Rainbow Wallet
