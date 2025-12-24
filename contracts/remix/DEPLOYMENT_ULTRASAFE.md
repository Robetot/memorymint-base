# MemoryMintUltraSafe Deployment Guide

Ultra-safe, anti-bot, production-grade NFT contract with configurable claim bonus system.

---

## Features

### 🛡️ Anti-Bot Protections (All Configurable)
- **Wallet mint limit** - Max mints per wallet (0 = unlimited)
- **Block cooldown** - Blocks between mints (0 = disabled)
- **tx.origin check** - Detect contract calls
- **Allowlist/Denylist** - Whitelist or blacklist addresses
- **Signature minting** - Off-chain signed approvals
- **FCFS cap** - First come first served limit

### 🎁 Claim Bonus System
- **FCFS Mode** - First come first served with caps
- **Unlimited Mode** - No restrictions
- **One-Time Mode** - One claim per wallet per level
- **Custom Mode** - Admin-defined rules
- **Eligibility Rules** - Score thresholds, NFT ownership

### 🔒 Safety Features
- Reentrancy protection
- Safe-mint receiver checks
- Zero-address protection
- Custom errors (gas optimized)
- Emergency pause/disable

---

## Deployment Steps

### 1. Open Remix IDE
Go to https://remix.ethereum.org

### 2. Create Contract File
1. Create folder: `contracts`
2. Create file: `MemoryMintUltraSafe.sol`
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

### Configure Anti-Bot (Optional)
```solidity
// Set wallet mint limit (0 = unlimited)
setWalletMintLimit(10)

// Set cooldown between mints (in blocks)
setMintCooldown(1)

// Enable tx.origin check
setTxOriginCheck(true)

// Set anti-bot mode (0=DISABLED, 1=SOFT, 2=MODERATE, 3=STRICT)
setAntiBotMode(2)

// Set FCFS mint cap (0 = unlimited)
setFCFSMintCap(1000)
```

### Configure Claim Bonus
```solidity
// Set claim mode (0=DISABLED, 1=FCFS, 2=UNLIMITED, 3=ONE_TIME, 4=CUSTOM)
setClaimMode(3)

// Configure bonus level
// level, amount (wei), active, claimsRemaining, minScore, requiresNFT
configureBonusLevel(1, 10000000000000000, true, 100, 500, false)
configureBonusLevel(5, 50000000000000000, true, 50, 2000, true)

// Set eligibility rules
// checkLevel, checkScore, checkNFTOwnership, useAndLogic
setEligibilityRules(true, true, false, true)

// Deposit bonus funds
depositBonusFunds{ value: 1000000000000000000 }()

// Set total claim cap (0 = unlimited)
setTotalClaimCap(500)
```

### Allowlist/Denylist
```solidity
// Enable allowlist
setAllowlistEnabled(true)

// Add addresses to allowlist
updateAllowlist([address1, address2], true)

// Enable denylist
setDenylistEnabled(true)

// Add addresses to denylist
updateDenylist([botAddress], true)
```

### Signature Minting
```solidity
// Enable signature requirement
setSignatureRequired(true)

// Set signer address (your backend wallet)
setSignatureSigner(0xYourSignerAddress)
```

---

## View Functions (Check Status)

```solidity
// Check if wallet can mint
canMint(walletAddress) // Returns (bool, string)

// Check if wallet can claim bonus
canClaim(walletAddress, level, userScore) // Returns (bool, string)

// Get wallet mint count
getWalletMintCount(walletAddress)

// Check if level claimed
hasClaimedLevel(walletAddress, level)

// Get active bonus levels
getActiveLevelIds()
```

---

## Emergency Controls

```solidity
// Pause all minting
pauseMinting(true)

// Emergency disable (cannot be bypassed)
setEmergencyMintDisabled(true)

// Withdraw funds (excludes bonus pool)
withdraw()

// Withdraw bonus funds
withdrawBonusFunds(amount)
```

---

## Gas Estimates

| Operation | Estimated Gas |
|-----------|--------------|
| Deploy | ~2,500,000 |
| Mint | ~150,000 |
| Claim Bonus | ~80,000 |
| Configure Level | ~60,000 |

---

## Anti-Bot Modes

| Mode | Level | Features |
|------|-------|----------|
| DISABLED | 0 | No checks |
| SOFT | 1 | Basic denylist |
| MODERATE | 2 | Limit + cooldown + tx.origin |
| STRICT | 3 | All protections |
| CUSTOM | 4 | Your configuration |

---

## Claim Modes

| Mode | Behavior |
|------|----------|
| DISABLED | No claims allowed |
| FCFS | First come first served with caps |
| UNLIMITED | No restrictions |
| ONE_TIME | One claim per wallet per level |
| CUSTOM | Admin-defined rules |

---

## Verified Contract Address

After deployment, save your contract address:
```
Base Mainnet: 0x_________________
```

Verify on BaseScan for transparency.
