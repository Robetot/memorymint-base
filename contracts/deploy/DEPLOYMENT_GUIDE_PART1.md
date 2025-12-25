# MemoryMintUltraSafe Deployment Guide - Part 1
## Preparation & Contract Setup

This guide covers deploying the **MemoryMintUltraSafe** contract on Base Mainnet using Remix IDE. The contract is fully compatible with:
- ✅ MetaMask
- ✅ Coinbase Wallet
- ✅ Base App (Smart Wallet)
- ✅ Farcaster Frames

---

## Prerequisites

Before you begin, ensure you have:

1. **A wallet with ETH on Base Mainnet**
   - MetaMask, Coinbase Wallet, or any EVM-compatible wallet
   - ~0.005 ETH for deployment gas (~$15-20)

2. **Base Network configured in your wallet**
   ```
   Network Name: Base
   RPC URL: https://mainnet.base.org
   Chain ID: 8453
   Currency: ETH
   Explorer: https://basescan.org
   ```

3. **Remix IDE open in your browser**
   - Go to: https://remix.ethereum.org

---

## Step 1: Upload Contract Files

### 1.1 Create the folder structure in Remix

In Remix File Explorer (left sidebar):
1. Click the **"+"** icon next to "contracts" folder
2. Create a new folder: `MemoryMint`

### 1.2 Create the interface file

1. Right-click the `MemoryMint` folder → **New File**
2. Name it: `IERC721Receiver.sol`
3. Paste this content:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}
```

### 1.3 Create the main contract file

1. Right-click the `MemoryMint` folder → **New File**
2. Name it: `MemoryMintUltraSafe.sol`
3. Copy the entire contract code from `contracts/remix/MemoryMintUltraSafe.sol` and paste it

---

## Step 2: Configure Compiler

### 2.1 Open Solidity Compiler

1. Click the **Solidity Compiler** icon (second icon in left sidebar, looks like "S")
2. Configure these settings:

| Setting | Value |
|---------|-------|
| **Compiler Version** | `0.8.20+commit.a1b79de6` |
| **Language** | Solidity |
| **EVM Version** | `paris` |
| **Enable optimization** | ✅ Checked |
| **Optimizer runs** | `200` |

### 2.2 Compile the contract

1. Select `MemoryMintUltraSafe.sol` in the file explorer
2. Click **"Compile MemoryMintUltraSafe.sol"**
3. ✅ Wait for green checkmark (no errors)

> **Troubleshooting:** If you see errors, ensure:
> - Compiler version is exactly `0.8.20`
> - EVM version is `paris`
> - Both files are in the same folder

---

## Step 3: Connect Your Wallet

### 3.1 Open Deploy & Run Transactions

1. Click the **Deploy & Run Transactions** icon (third icon, looks like Ethereum logo with arrow)

### 3.2 Configure environment

| Setting | Value |
|---------|-------|
| **Environment** | `Injected Provider - MetaMask` (or your wallet) |
| **Account** | Your wallet address (will auto-populate) |
| **Gas Limit** | Leave as default |
| **Value** | `0` |

### 3.3 Connect wallet

1. Click the dropdown next to "Injected Provider"
2. Select your wallet (MetaMask, Coinbase Wallet, etc.)
3. Approve the connection in your wallet popup
4. **Verify you are on Base Mainnet (Chain ID: 8453)**

> ⚠️ **CRITICAL:** Double-check you are on Base Mainnet, NOT Base Goerli or Ethereum Mainnet!

---

## Step 4: Deploy Contract

### 4.1 Select the contract

In the "Contract" dropdown, select:
```
MemoryMintUltraSafe - contracts/MemoryMint/MemoryMintUltraSafe.sol
```

### 4.2 Enter constructor parameters

Click the arrow next to **Deploy** to expand the constructor fields:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `name_` | `"MemoryMint"` | NFT collection name |
| `symbol_` | `"MMINT"` | NFT ticker symbol |
| `baseURI_` | `"ipfs://YOUR_BASE_CID/"` | Base IPFS URI (include trailing slash) |

**Example:**
```
name_: "MemoryMint"
symbol_: "MMINT"
baseURI_: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/"
```

> 💡 **Tip:** If you don't have an IPFS base URI yet, use a placeholder like `"https://api.memorymint.xyz/metadata/"` and update later with `setBaseURI()`.

### 4.3 Deploy

1. Click **"transact"** (Deploy button)
2. Confirm the transaction in your wallet
   - Gas estimate: ~2,500,000 gas (~0.004 ETH)
3. Wait for transaction confirmation (10-30 seconds on Base)

### 4.4 Save your contract address

After deployment, you'll see the contract in "Deployed Contracts" section:
```
MEMORYMINTULTRASAFE AT 0x...
```

📝 **Copy and save this address!** You'll need it for Part 2 and frontend integration.

---

## Step 5: Verify on BaseScan (Optional but Recommended)

### 5.1 Go to BaseScan

1. Open: https://basescan.org/address/YOUR_CONTRACT_ADDRESS
2. Click the **"Contract"** tab
3. Click **"Verify and Publish"**

### 5.2 Enter verification details

| Field | Value |
|-------|-------|
| Compiler Type | Solidity (Single file) |
| Compiler Version | v0.8.20+commit.a1b79de6 |
| Open Source License | MIT License (MIT) |
| Optimization | Yes, 200 runs |
| EVM Version | paris |

### 5.3 Paste contract code

1. Paste the entire contract source code
2. For constructor arguments, ABI-encode your parameters:
   - Use: https://abi.hashex.org/
   - Or manually: `name`, `symbol`, `baseURI` encoded

3. Click **"Verify and Publish"**

---

## Default Configuration After Deployment

The contract deploys with these **production-safe defaults**:

| Setting | Default Value | Why |
|---------|---------------|-----|
| `antiBotMode` | `MODERATE (2)` | Balanced protection |
| `txOriginCheck` | `false` | ✅ Smart wallet compatible |
| `walletMintLimit` | `10` | Prevents mass minting |
| `mintCooldownBlocks` | `2` | ~4 seconds between mints |
| `signatureRequired` | `true` | Requires backend signature |
| `denylistEnabled` | `true` | Can block bad actors |
| `signatureExpirationSeconds` | `3600` | 1 hour expiry |
| `mintPrice` | `0` | Free minting (gas only) |
| `claimMode` | `DISABLED` | No bonus claims by default |
| `signatureSigner` | Deployer address | You can sign mints |

---

## ✅ Part 1 Complete!

Your contract is now deployed. Continue to **Part 2** for:
- Setting mint price
- Configuring anti-bot settings
- Setting up bonus claims
- Testing with different wallets
- Frontend integration

---

## Quick Reference: Contract Functions

### Read Functions (Free)
```solidity
name()                    // Collection name
symbol()                  // Collection symbol
totalSupply()             // Total minted
mintPrice()               // Current mint price
antiBotMode()             // Current anti-bot mode
canMint(address)          // Check if wallet can mint
getWalletMintCount(address) // Mints by wallet
```

### Write Functions (Require Gas)
```solidity
mintWithSignature(uri, expiration, signature) // Mint with backend signature
mintNFT(uri)              // Mint without signature (if enabled)
claimBonus(level, score, proof)  // Claim level bonus
```

### Admin Functions (Owner Only)
```solidity
setMintPrice(uint256)     // Set mint price in wei
setAntiBotMode(mode, txOriginCheck) // Configure protection
setSignatureSigner(address) // Set backend signer
setBaseURI(string)        // Update metadata base URI
withdraw()                // Withdraw ETH to owner
pause() / unpause()       // Emergency controls
```

---

**→ Continue to [Part 2: Configuration & Integration](./DEPLOYMENT_GUIDE_PART2.md)**
