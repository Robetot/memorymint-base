# MemoryMintUltraSafe v4 - 9-File Split Contract Deployment Guide

Complete guide for deploying the split contract system on Base Mainnet using Remix IDE.

## Contract Architecture

```
1_Interfaces.sol          → IERC721Receiver, IERC20
        ↓
2_ErrorsEnumsStructs.sol  → Custom errors, enums, structs
        ↓
3_Storage.sol             → All state variables & constants
        ↓
4_BaseLogic.sol           → Modifiers, events, ERC-721 core
        ↓
5_FeatureCore.sol         → Anti-bot, signature verification, USDC
        ↓
6_Minting.sol             → Mint functions (ETH/USDC ± signature)
        ↓
7_BonusClaim.sol          → Claim bonus with level verification
        ↓
8_MemoryMintUltraSafe.sol → Admin functions, view functions, constructor
        ↓
9_MemoryMintUltraSafe_Bonus.sol → Bonus config, deposits, withdrawals (DEPLOY THIS)
```

## File Summary

| File | Description | ~Lines |
|------|-------------|--------|
| `1_Interfaces.sol` | IERC721Receiver, IERC20 interfaces | 25 |
| `2_ErrorsEnumsStructs.sol` | Custom errors, enums, structs | 95 |
| `3_Storage.sol` | State variables, constants, BASE_USDC address | 95 |
| `4_BaseLogic.sol` | Modifiers, events, ERC-721 functions | 200 |
| `5_FeatureCore.sol` | Anti-bot checks, signature verification | 165 |
| `6_Minting.sol` | mintWithETH, mintWithUSDC, mintWithSignature | 115 |
| `7_BonusClaim.sol` | claimBonus(level, gameLevel, proof) | 160 |
| `8_MemoryMintUltraSafe.sol` | Admin setters, internal helpers, views | 200 |
| `9_MemoryMintUltraSafe_Bonus.sol` | Bonus admin, deposits, receive() | 120 |

**Total: ~1,175 lines**

---

## Step 1: Upload Files to Remix

1. Go to [Remix IDE](https://remix.ethereum.org)
2. Create a new folder: `MemoryMintUltraSafe`
3. Upload all 9 `.sol` files in order:
   - `1_Interfaces.sol`
   - `2_ErrorsEnumsStructs.sol`
   - `3_Storage.sol`
   - `4_BaseLogic.sol`
   - `5_FeatureCore.sol`
   - `6_Minting.sol`
   - `7_BonusClaim.sol`
   - `8_MemoryMintUltraSafe.sol`
   - `9_MemoryMintUltraSafe_Bonus.sol`

---

## Step 2: Compiler Settings

In Remix → Solidity Compiler tab:

| Setting | Value |
|---------|-------|
| Compiler | `0.8.20` or higher |
| EVM Version | `paris` |
| Optimization | ✅ Enabled |
| Runs | `200` |

### Compile

1. Open `9_MemoryMintUltraSafe_Bonus.sol`
2. Click **Compile**
3. All 9 files compile together via imports
4. Verify: No errors, only the expected contract appears

---

## Step 3: Connect Wallet

1. Open **Deploy & Run Transactions** tab
2. Environment: **Injected Provider - MetaMask**
3. Connect MetaMask to **Base Mainnet**
   - Network Name: `Base`
   - RPC URL: `https://mainnet.base.org`
   - Chain ID: `8453`
   - Currency: `ETH`
   - Explorer: `https://basescan.org`

4. Ensure you have ETH for gas (~0.001-0.003 ETH)

---

## Step 4: Deploy Contract

### Select Contract
From the dropdown, select:
```
MemoryMintUltraSafe_Bonus - contracts/remix/split/9_MemoryMintUltraSafe_Bonus.sol
```

### Constructor Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `name_` | `"MemoryMint Animal Cards"` | NFT collection name |
| `symbol_` | `"MMANIMAL"` | NFT symbol |
| `baseURI_` | `"ipfs://YOUR_CID/"` | IPFS metadata base URI |

**Example:**
```
"MemoryMint Animal Cards","MMANIMAL","ipfs://bafybeidxxxxxx/"
```

### Deploy
1. Click **Deploy**
2. Confirm in MetaMask
3. Wait for confirmation (~2-5 seconds on Base)
4. Copy the deployed contract address

---

## Step 5: Verify on BaseScan

1. Go to [BaseScan](https://basescan.org)
2. Search your contract address
3. Click **Contract** → **Verify and Publish**
4. Settings:
   - Compiler Type: `Solidity (Standard-Json-Input)`
   - Compiler Version: `v0.8.20+commit.a1b79de6`
   - License: `MIT`
5. Upload the Standard JSON Input from Remix:
   - Remix → Compile → Copy ABI/Metadata
   - Or use the "artifacts" folder

---

## Step 6: Post-Deployment Configuration

### Required Setup

```solidity
// 1. Set signature signer (if using backend signatures)
setSignatureSigner(0xYOUR_BACKEND_SIGNER_ADDRESS);

// 2. Configure first bonus level
configureBonusLevel(
    1,           // level ID
    0.001 ether, // ETH bonus amount
    0,           // USDC bonus amount (0 if not used)
    true,        // active
    100,         // claims remaining
    false        // requiresNFT
);

// 3. Enable claims
setClaimMode(3); // ClaimMode.ONE_TIME

// 4. Deposit bonus funds
depositBonusFundsETH{value: 0.1 ether}();
```

### Optional Settings

```solidity
// Anti-bot settings
setAntiBotMode(1);        // 0=DISABLED, 1=MODERATE, 2=STRICT
setWalletMintLimit(10);   // Max mints per wallet
setMintCooldown(2);       // Blocks between mints

// Pricing (if not free mint)
setMintPriceETH(0.001 ether);

// Signature requirement
setSignatureRequired(true);  // Require backend signature for mints

// Update metadata
setBaseURI("ipfs://NEW_CID/");
```

---

## ClaimMode Values

| Value | Mode | Description |
|-------|------|-------------|
| 0 | `DISABLED` | Claims disabled |
| 1 | `FIRST_COME` | First-come-first-served |
| 2 | `DAILY` | Once per day per wallet |
| 3 | `ONE_TIME` | Once per wallet per level |

---

## AntiBotMode Values

| Value | Mode | Description |
|-------|------|-------------|
| 0 | `DISABLED` | No anti-bot checks |
| 1 | `MODERATE` | Cooldown + wallet limits |
| 2 | `STRICT` | + tx.origin check (blocks smart wallets) |

---

## Key Function Signatures

### For Mini-Game Hooks

```solidity
// Minting
mintWithETH() payable                    // Free or paid ETH mint
mintWithSignatureETH(uint256 expiration, bytes signature) payable

// Claiming  
claimBonus(uint256 level, uint256 gameLevel, bytes levelProof)

// Views
canMint(address wallet) → bool
canClaim(address wallet, uint256 levelId) → bool
getNonce(address wallet) → uint256
balanceOf(address owner) → uint256
```

### Admin Functions

```solidity
// Currency
setETHEnabled(bool)
setUSDCEnabled(bool)
setActiveMintCurrency(PaymentCurrency)  // 0=ETH, 1=USDC

// Minting
setMintPriceETH(uint256)
pauseMinting(bool)
setBaseURI(string)

// Anti-bot
setAntiBotMode(AntiBotMode)
setWalletMintLimit(uint256)
updateAllowlist(address[], bool)
updateDenylist(address[], bool)

// Bonus
setClaimMode(ClaimMode)
configureBonusLevel(uint256, uint256, uint256, bool, uint256, bool)
depositBonusFundsETH() payable
withdrawBonusFundsETH(uint256)

// Ownership
transferOwnership(address)
withdrawETH(uint256)
emergencyWithdrawAll()
```

---

## Gas Estimates (Base Mainnet)

| Operation | Gas | ~Cost @ 0.1 gwei |
|-----------|-----|------------------|
| Deploy | ~3,500,000 | ~0.00035 ETH |
| mintWithETH | ~85,000 | ~0.0000085 ETH |
| mintWithSignatureETH | ~95,000 | ~0.0000095 ETH |
| claimBonus | ~75,000 | ~0.0000075 ETH |
| configureBonusLevel | ~65,000 | ~0.0000065 ETH |

---

## Security Features

### v4 Security Fixes Included

1. **Nonce-based replay protection** - Signatures can't be reused
2. **Fixed signature expiration** - `[now, now+max]` window validation
3. **Smart wallet compatible** - `receive()` allows contract deposits
4. **Duplicate prevention** - `activeLevelIds` array integrity maintained
5. **Zero-amount validation** - Prevents empty deposits/withdrawals
6. **CEI pattern** - Checks-Effects-Interactions for reentrancy safety
7. **Base Mainnet lock** - Claims only work on chain ID 8453

---

## Frontend Integration

Update your `useNFTMint.ts` hook with the deployed contract address:

```typescript
const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_ADDRESS";

// Signature format (v4 with nonce)
const nonce = await contract.getNonce(walletAddress);
const messageHash = ethers.solidityPackedKeccak256(
  ['address', 'uint256', 'address', 'uint256', 'uint256'],
  [walletAddress, nonce, contractAddress, chainId, expiration]
);
```

---

## Troubleshooting

### Compilation Errors

| Error | Solution |
|-------|----------|
| "File not found" | Ensure all 9 files are in same folder |
| "Identifier not found" | Check import paths match file names |
| "Stack too deep" | Enable optimizer with 200 runs |

### Deployment Errors

| Error | Solution |
|-------|----------|
| "Insufficient funds" | Add ETH to wallet for gas |
| "Contract too large" | Enable optimizer, use 200 runs |
| "Wrong network" | Switch MetaMask to Base Mainnet |

### Runtime Errors

| Error | Solution |
|-------|----------|
| `OnlyBaseMainnet()` | Claims only work on Base (chain 8453) |
| `SignatureExpired()` | Generate fresh signature with new expiration |
| `SignatureAlreadyUsed()` | Nonce incremented, get new signature |
| `MintingPaused()` | Call `pauseMinting(false)` |
| `WalletLimitExceeded()` | Wallet reached mint limit |

---

## Contract Addresses

After deployment, update these files:

1. `src/hooks/useNFTMint.ts` - Contract address
2. `src/hooks/useNFTCollection.ts` - Contract address  
3. Backend signer - Signature generation with nonce

---

## Support

- Base Documentation: https://docs.base.org
- Remix IDE: https://remix.ethereum.org
- BaseScan: https://basescan.org
- OpenZeppelin (ERC-721): https://docs.openzeppelin.com/contracts
