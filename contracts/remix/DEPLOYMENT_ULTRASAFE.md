# MemoryMintUltraSafe v2 - Deployment Guide

## Production Fixes Applied (v2)

| Fix | Issue | Solution | Result |
|-----|-------|----------|--------|
| **#1** | tx.origin blocks Base App & Smart Wallets | Disabled by default, only enabled in STRICT mode | ✅ Smart wallets work out of box |
| **#2** | Level check not enforced on-chain | Level verification via signed proof when `checkLevel=true` | ✅ Prevents fake level claims |
| **#3** | activeLevelIds grows forever | Auto-removes levels when deactivated | ✅ Array stays clean |
| **#4** | Signature storage grows forever | Signatures have configurable expiration | ✅ Bounded storage growth |
| **#5** | Unsafe default configuration | Production-safe constructor defaults | ✅ Safe without manual config |

---

## Safe Defaults (No Manual Config Needed)

```solidity
// Constructor sets these automatically:
antiBotMode = MODERATE           // Standard protection
txOriginCheck = false            // FIX #1: Smart wallet compatible
walletMintLimit = 10             // Reasonable default
mintCooldownBlocks = 2           // ~4 seconds on Base
denylistEnabled = true           // Protection on
signatureRequired = true         // Anti-bot
signatureExpirationSeconds = 3600 // 1 hour
signatureSigner = deployer       // Owner is default signer
```

---

## Platform Compatibility

| Platform | Default Config | Notes |
|----------|---------------|-------|
| Base App | ✅ Works | tx.origin disabled in MODERATE |
| Coinbase Smart Wallet | ✅ Works | tx.origin disabled in MODERATE |
| Farcaster Frames | ✅ Works | tx.origin disabled in MODERATE |
| MetaMask | ✅ Works | All modes |
| OpenSea | ✅ Works | ERC-721 + ERC-4906 compliant |
| MemoryMint Game | ✅ Works | All interfaces preserved |

**⚠️ Warning:** STRICT mode enables tx.origin checks, which **blocks smart wallets**. Use only for maximum bot protection when smart wallet support isn't needed.

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

### 5. Post-Deploy (Optional Tuning)

```solidity
// Set mint price
setMintPrice(1000000000000000) // 0.001 ETH

// Adjust wallet limit if needed
setWalletMintLimit(5)

// Set different signer for production
setSignatureSigner(0xYourBackendSignerAddress)
```

---

## Anti-Bot Mode Reference

| Mode | tx.origin | Wallet Limit | Cooldown | Denylist | Smart Wallet Support |
|------|-----------|--------------|----------|----------|---------------------|
| DISABLED | ❌ | ❌ | ❌ | ❌ | ✅ |
| SOFT | ❌ | ❌ | ❌ | ✅ | ✅ |
| **MODERATE** (default) | ❌ | ✅ | ✅ | ✅ | ✅ |
| STRICT | ✅ | ✅ | ✅ | ✅ | ❌ |
| CUSTOM | Manual | Manual | Manual | Manual | Depends |

**Recommendation:** Stay on MODERATE for production unless you specifically need STRICT.

---

## Claim Bonus with Level Verification (FIX #2)

### When `checkLevel = true`:

Users must provide a signed proof of level completion:

```typescript
// Backend generates level proof
const levelHash = ethers.solidityPackedKeccak256(
  ['address', 'uint256', 'address', 'uint256'],
  [userWallet, gameLevel, contractAddress, 8453] // Base chainId
);
const levelProof = await signer.signMessage(ethers.getBytes(levelHash));

// Frontend calls new claimBonus
contract.claimBonus(
  bonusLevelId,    // The bonus level to claim
  gameLevel,       // The game level completed
  userScore,       // User's score
  levelProof       // Backend-signed proof
);
```

### When `checkLevel = false`:

Use the legacy function (no proof needed):

```typescript
contract.claimBonus(level, userScore);
```

---

## Mint with Signature (FIX #4 - Expiration)

### Backend Signature Generation

```typescript
const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

const messageHash = ethers.solidityPackedKeccak256(
  ['address', 'address', 'uint256', 'uint256'],
  [userWallet, contractAddress, 8453, expiration]
);

const signature = await signer.signMessage(ethers.getBytes(messageHash));
```

### Frontend Mint Call

```typescript
const tx = await contract.mintWithSignature(
  metadataURI,
  expiration,
  signature,
  { value: mintPrice }
);
```

---

## Admin Configuration

### Configure Signature Expiration (FIX #4)

```solidity
// Set to 1 hour (default)
setSignatureExpiration(3600)

// Set to 24 hours
setSignatureExpiration(86400)

// Disable expiration (not recommended)
setSignatureExpiration(0)
```

### Configure Level Verification (FIX #2)

```solidity
// Enable level check (requires signed proof)
setEligibilityRules(
  true,   // checkLevel - REQUIRES SIGNED PROOF
  true,   // checkScore
  false,  // checkNFTOwnership
  true    // useAndLogic (AND = all must pass)
)

// Disable level check (trusts frontend)
setEligibilityRules(
  false,  // checkLevel - NO PROOF REQUIRED
  true,   // checkScore
  false,  // checkNFTOwnership
  true    // useAndLogic
)
```

### Configure Bonus Levels

```solidity
// Create level 1 with FCFS cap of 100
configureBonusLevel(
  1,                      // level ID
  10000000000000000,      // 0.01 ETH bonus
  true,                   // active
  100,                    // claimsRemaining (FCFS cap)
  500,                    // minScore
  false                   // requiresNFT
)

// Deactivate a level (auto-removes from activeLevelIds)
deactivateBonusLevel(1)
```

---

## View Functions

```solidity
// Check mint eligibility
canMint(walletAddress) // Returns (bool, string)

// Check claim eligibility
canClaim(walletAddress, level, userScore) // Returns (bool, string)

// Get active bonus levels (cleaned array - FIX #3)
getActiveLevelIds() // Returns uint256[]

// Get signature expiration setting
signatureExpirationSeconds()
```

---

## Emergency Controls

```solidity
// Pause minting
pauseMinting(true)

// Emergency stop (cannot be bypassed)
setEmergencyMintDisabled(true)

// Withdraw mint revenue
withdraw()

// Withdraw bonus funds
withdrawBonusFunds(amount)

// Emergency: withdraw everything
emergencyWithdrawAll()
```

---

## Gas Estimates (Base Mainnet)

| Operation | Estimated Gas | ~Cost @ 0.01 gwei |
|-----------|--------------|-------------------|
| Deploy | ~2,900,000 | ~0.000029 ETH |
| mintWithSignature | ~170,000 | ~0.0000017 ETH |
| claimBonus (with proof) | ~95,000 | ~0.00000095 ETH |
| transferFrom | ~65,000 | ~0.00000065 ETH |

---

## Breaking Changes from v1

### 1. `mintWithSignature` signature format changed

**v1:**
```typescript
mintWithSignature(metadataURI, messageHash, signature)
```

**v2 (FIX #4):**
```typescript
mintWithSignature(metadataURI, expiration, signature)
```

### 2. `claimBonus` with level verification

**v1:**
```typescript
claimBonus(level, userScore)
```

**v2 (FIX #2) - when checkLevel enabled:**
```typescript
claimBonus(level, gameLevel, userScore, levelProof)
```

**v2 - legacy compatibility (when checkLevel disabled):**
```typescript
claimBonus(level, userScore) // Still works
```

---

## Verification Checklist

- [ ] Contract deployed to Base Mainnet
- [ ] Contract verified on BaseScan
- [ ] `canMint()` returns `(true, "Eligible to mint")`
- [ ] Signature signer set (if different from deployer)
- [ ] Test mint from Base App works
- [ ] Test mint from Coinbase Wallet works
- [ ] Bonus levels configured (if using claims)
- [ ] Bonus pool funded (if using claims)
- [ ] Level proof generation working in backend (if checkLevel enabled)

---

## Contract Verification (BaseScan)

1. Go to your contract on BaseScan
2. Click "Verify & Publish"
3. Settings:
   - Compiler: `0.8.20`
   - Optimization: Yes, 200 runs
   - EVM Version: `paris`
4. Paste full source code (contract is self-contained)
5. Enter ABI-encoded constructor arguments
