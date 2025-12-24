# MemoryMintUltraSafe Deployment Guide

## Security Audit Summary

### Critical Fixes Applied

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | CEI Pattern violation in `claimBonus` | **CRITICAL** | All state updates now occur before ETH transfer |
| 2 | FCFS `claimsRemaining` underflow risk | **CRITICAL** | Added check for >0 before decrement |
| 3 | Signature replay without wallet binding | **CRITICAL** | Signature verification now includes wallet address |
| 4 | Denylist bypassed by allowlist | **HIGH** | Denylist check now happens FIRST, takes absolute precedence |
| 5 | Allowlisted wallets skip denylist | **HIGH** | Even allowlisted wallets are checked against denylist |
| 6 | `mintWithSignature` missing denylist check | **HIGH** | Added explicit denylist check |
| 7 | Approval not cleared properly on transfer | **MEDIUM** | Emit `Approval(owner, address(0), tokenId)` on transfer |
| 8 | EIP-2 signature malleability | **MEDIUM** | Added s-value upper bound check |
| 9 | Missing `receive()` attribution | **LOW** | ETH sent directly now credits `bonusPoolBalance` |
| 10 | Inefficient storage reads | **LOW** | Used local variable caching throughout |

### Security Guarantees

| Guarantee | Status |
|-----------|--------|
| No burn functions added | ✅ |
| No URI update logic added | ✅ |
| All game interfaces preserved | ✅ |
| CEI pattern enforced | ✅ |
| Reentrancy protected | ✅ |
| ERC-721 compliant | ✅ |
| ERC-4906 compliant (OpenSea) | ✅ |
| Anti-bot hardened | ✅ |

---

## Deployment Steps

### 1. Open Remix IDE
Go to https://remix.ethereum.org

### 2. Create Contract File
1. Create folder: `contracts`
2. Create file: `contracts/MemoryMintUltraSafe.sol`
3. Copy entire contract code

### 3. Compiler Settings
- **Compiler**: `0.8.20`
- **Optimization**: ✅ Enabled, `200` runs
- **EVM Version**: `paris`

### 4. Deploy
1. Environment: `Injected Provider - MetaMask`
2. Network: Base Mainnet (Chain ID: 8453)
3. Contract: `MemoryMintUltraSafe`
4. Constructor Parameters:
   - `name_`: `"MemoryMint"`
   - `symbol_`: `"MMINT"`
   - `baseURI_`: `"ipfs://YOUR_CID/"`

5. Click **Deploy** → Confirm in MetaMask

---

## Post-Deployment Setup

### Configure Mint Price
```solidity
setMintPrice(1000000000000000) // 0.001 ETH
```

### Configure Anti-Bot (Recommended)
```solidity
// Set wallet mint limit (0 = unlimited)
setWalletMintLimit(10)

// Set cooldown between mints (in blocks, ~2 sec per block on Base)
setMintCooldown(1)

// Enable tx.origin check (blocks contract mints)
setTxOriginCheck(true)

// Set anti-bot mode (0=DISABLED, 1=SOFT, 2=MODERATE, 3=STRICT)
setAntiBotMode(2)

// Set FCFS mint cap (0 = unlimited)
setFCFSMintCap(1000)
```

### Configure Claim Bonus
```solidity
// Set claim mode (0=DISABLED, 1=FCFS, 2=UNLIMITED, 3=ONE_TIME, 4=CUSTOM)
setClaimMode(3) // ONE_TIME recommended

// Configure bonus level
// configureBonusLevel(level, amount, active, claimsRemaining, minScore, requiresNFT)
configureBonusLevel(1, 10000000000000000, true, 100, 500, false)  // Level 1: 0.01 ETH
configureBonusLevel(5, 50000000000000000, true, 50, 2000, true)   // Level 5: 0.05 ETH

// Set eligibility rules
// setEligibilityRules(checkLevel, checkScore, checkNFTOwnership, useAndLogic)
setEligibilityRules(true, true, false, true) // AND logic: must meet all

// Deposit bonus funds
depositBonusFunds{ value: 1000000000000000000 }() // 1 ETH

// Set total claim cap (0 = unlimited)
setTotalClaimCap(500)
```

### Allowlist/Denylist
```solidity
// Denylist is enabled by default - add known bots
updateDenylist([botAddress1, botAddress2], true)

// Enable allowlist for exclusive minting
setAllowlistEnabled(true)
updateAllowlist([vipAddress1, vipAddress2], true)
```

### Signature Minting (For Maximum Security)
```solidity
// Enable signature requirement
setSignatureRequired(true)

// Set signer address (your backend wallet)
setSignatureSigner(0xYourSignerAddress)
```

---

## Anti-Bot Modes

| Mode | Value | Features |
|------|-------|----------|
| DISABLED | 0 | No checks (not recommended) |
| SOFT | 1 | Denylist only |
| MODERATE | 2 | Limit + cooldown + tx.origin |
| STRICT | 3 | All protections + reduced limits |
| CUSTOM | 4 | Your configuration |

**Recommended**: MODERATE (2) for public mints, STRICT (3) for high-value drops.

---

## Claim Modes

| Mode | Value | Behavior |
|------|-------|----------|
| DISABLED | 0 | No claims allowed |
| FCFS | 1 | First come first served with per-level caps |
| UNLIMITED | 2 | No restrictions (use with caution) |
| ONE_TIME | 3 | One claim per wallet per level (recommended) |
| CUSTOM | 4 | Uses eligibility rules |

**Recommended**: ONE_TIME (3) to prevent abuse.

---

## Denylist Priority (Critical Security Feature)

The denylist check now takes **absolute precedence**:

1. ✅ Denylisted wallet → **BLOCKED** (even if allowlisted)
2. Allowlist enabled + wallet allowlisted → Allowed
3. Allowlist enabled + wallet NOT allowlisted → Blocked
4. Allowlist disabled → Other checks apply

This prevents compromised allowlisted wallets from being exploited.

---

## View Functions

```solidity
// Check if wallet can mint
canMint(walletAddress) // Returns (bool, string)

// Check if wallet can claim bonus
canClaim(walletAddress, level, userScore) // Returns (bool, string)

// Get wallet mint count
getWalletMintCount(walletAddress)

// Check if level claimed
hasClaimedLevel(walletAddress, level)

// Get total claimed by wallet
getTotalClaimed(walletAddress)

// Get active bonus levels
getActiveLevelIds()

// Get total supply
totalSupply()
```

---

## Emergency Controls

```solidity
// Pause all minting
pauseMinting(true)

// Emergency disable (cannot be bypassed)
setEmergencyMintDisabled(true)

// Withdraw mint revenue (preserves bonus pool)
withdraw()

// Withdraw bonus funds only
withdrawBonusFunds(amount)

// Emergency: withdraw everything
emergencyWithdrawAll()
```

---

## Gas Estimates (Base Mainnet)

| Operation | Estimated Gas | ~Cost @ 0.01 gwei |
|-----------|--------------|-------------------|
| Deploy | ~2,800,000 | ~0.000028 ETH |
| mintNFT | ~150,000 | ~0.0000015 ETH |
| mintWithSignature | ~165,000 | ~0.00000165 ETH |
| claimBonus | ~80,000 | ~0.0000008 ETH |
| transferFrom | ~65,000 | ~0.00000065 ETH |
| safeTransferFrom | ~75,000 | ~0.00000075 ETH |

---

## Integration with MemoryMint Game

### Function Signatures (Unchanged)

```solidity
// Minting
function mintNFT(string calldata metadataURI) external payable returns (uint256)
function mintWithSignature(string calldata metadataURI, bytes32 messageHash, bytes calldata signature) external payable returns (uint256)

// Claiming
function claimBonus(uint256 level, uint256 userScore) external returns (uint256)

// View
function canMint(address wallet) external view returns (bool, string memory)
function canClaim(address wallet, uint256 level, uint256 userScore) external view returns (bool, string memory)
```

### Frontend Integration

```typescript
// Check eligibility before mint
const [canMintResult, reason] = await contract.canMint(userAddress);
if (!canMintResult) {
  toast.error(reason);
  return;
}

// Mint NFT
const tx = await contract.mintNFT(metadataURI, { value: mintPrice });

// Claim bonus
const [canClaimResult, claimReason] = await contract.canClaim(userAddress, level, score);
if (canClaimResult) {
  const claimTx = await contract.claimBonus(level, score);
}
```

---

## Verification Checklist

Before going live:

- [ ] Contract deployed to Base Mainnet
- [ ] Contract verified on BaseScan
- [ ] Mint price configured
- [ ] Anti-bot mode set to MODERATE or STRICT
- [ ] Denylist enabled (default)
- [ ] Known bot addresses added to denylist
- [ ] Bonus levels configured (if using claims)
- [ ] Bonus pool funded (if using claims)
- [ ] Claim mode set appropriately
- [ ] Tested mint from game frontend
- [ ] Tested claim from game frontend
- [ ] Ownership transferred to multisig (recommended for production)

---

## Contract Verification

### BaseScan Verification

1. Go to your contract on BaseScan
2. Click "Verify & Publish"
3. Settings:
   - Compiler: `0.8.20`
   - Optimization: Yes, 200 runs
   - EVM Version: `paris`
4. Paste flattened source (contract is already self-contained)
5. Enter ABI-encoded constructor arguments

### Constructor Args Encoding
```
name_: "MemoryMint"
symbol_: "MMINT"  
baseURI_: "ipfs://YOUR_CID/"
```
