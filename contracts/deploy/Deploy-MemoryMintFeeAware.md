# MemoryMintFeeAware Deployment Guide

## Contract: MemoryMintFeeAware.sol

Ultra-optimized ERC-721 with dynamic pricing for Base Mainnet.

### Features
- ✅ Unlimited supply (no cap)
- ✅ Payable mint with dynamic pricing
- ✅ Owner-adjustable mintPrice (0 = free)
- ✅ Single-transaction mint
- ✅ Extreme gas optimization
- ✅ Works with Base App, MetaMask, Farcaster

---

## Deployment Steps

### Option 1: Deploy via Remix (Recommended)

1. **Open Remix IDE**
   - Go to https://remix.ethereum.org

2. **Create Contract File**
   - Create new file: `MemoryMintFeeAware.sol`
   - Paste the contract code

3. **Compile**
   - Select Solidity 0.8.20
   - Enable optimization: 200 runs
   - EVM version: paris

4. **Deploy to Base Mainnet**
   - Connect MetaMask to Base Mainnet (chainId 8453)
   - Select "Injected Provider - MetaMask"
   - Deploy `MemoryMintFeeAware`
   - No constructor arguments needed
   - Confirm transaction

5. **Record Contract Address**
   - Copy the deployed contract address
   - Update `NFT_CONTRACT_ADDRESS` in `src/hooks/useNFTMint.ts`

### Option 2: Deploy via Hardhat/Foundry

```bash
# Using Foundry
forge create --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY \
  --etherscan-api-key $BASESCAN_API_KEY \
  --verify \
  contracts/MemoryMintFeeAware.sol:MemoryMintFeeAware
```

---

## Verification on BaseScan

### Via Remix Plugin
1. Install "Etherscan - Contract Verification" plugin
2. Enter BaseScan API key
3. Click Verify

### Via BaseScan Website
1. Go to https://basescan.org/verifyContract
2. Enter contract address
3. Select:
   - Compiler: 0.8.20
   - Optimization: Yes (200 runs)
   - License: MIT
4. Paste flattened contract code
5. Verify

### Via Command Line
```bash
# Using Foundry
forge verify-contract $CONTRACT_ADDRESS \
  contracts/MemoryMintFeeAware.sol:MemoryMintFeeAware \
  --chain-id 8453 \
  --etherscan-api-key $BASESCAN_API_KEY
```

---

## Post-Deployment Setup

### 1. Update Frontend
Update the contract address in `src/hooks/useNFTMint.ts`:

```typescript
const NFT_CONTRACT_ADDRESS = '0xYOUR_NEW_CONTRACT_ADDRESS';
```

### 2. Set Mint Price (Optional)
If you want paid minting, call `setMintPrice`:

```solidity
// Set mint price to 0.001 ETH
setMintPrice(1000000000000000)

// Set to free
setMintPrice(0)
```

### 3. Verify Deployment
Test these functions on BaseScan:
- `mintPrice()` - Should return 0 (free) or your set price
- `owner()` - Should return deployer address
- `name()` - Should return "MemoryMint"
- `symbol()` - Should return "MMINT"

---

## Contract Functions

### Public (Anyone)
| Function | Description |
|----------|-------------|
| `mintNFT(string tokenURI)` | Mint 1 NFT with metadata |
| `batchMint(uint256 quantity)` | Mint 1-10 NFTs |
| `mintPrice()` | Get current mint price (wei) |
| `totalSupply()` | Get total minted count |

### Owner Only
| Function | Description |
|----------|-------------|
| `setMintPrice(uint256)` | Set mint price in wei |
| `withdraw()` | Withdraw to owner |
| `withdrawTo(address)` | Withdraw to specific address |
| `transferOwnership(address)` | Transfer ownership |

---

## Gas Estimates (Base Mainnet)

| Operation | Estimated Gas | Cost @ 0.001 gwei |
|-----------|--------------|-------------------|
| mintNFT | ~65,000 | ~0.000065 ETH |
| batchMint(5) | ~200,000 | ~0.0002 ETH |
| batchMint(10) | ~350,000 | ~0.00035 ETH |

---

## Security Notes

1. **Owner Key**: Keep deployer private key secure
2. **No Proxy**: Contract is not upgradeable (by design)
3. **No Reentrancy**: Safe by design (no external calls in mint)
4. **Withdraw**: Only owner can withdraw funds

---

## Checklist

- [ ] Contract deployed to Base Mainnet
- [ ] Contract verified on BaseScan
- [ ] Frontend updated with new address
- [ ] mintPrice set (or left at 0 for free)
- [ ] Test mint works in Base App
- [ ] Test mint works in MetaMask
- [ ] Network fee displays correctly
- [ ] No stuck transactions
