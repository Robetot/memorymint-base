# MemoryMintUltraSafe Deployment Guide - Part 2
## Configuration, Testing & Integration

This guide covers post-deployment configuration for the **MemoryMintUltraSafe** contract, ensuring compatibility with all wallet types.

---

## Prerequisites

- ✅ Completed Part 1 (contract deployed)
- ✅ Contract address saved
- ✅ Contract verified on BaseScan (recommended)

---

## Step 6: Configure Mint Price

### 6.1 Set mint price (optional)

If you want to charge for mints (beyond gas):

```solidity
// In Remix, call setMintPrice with the price in wei
// Example: 0.001 ETH = 1000000000000000 wei

setMintPrice(1000000000000000)  // 0.001 ETH
setMintPrice(5000000000000000)  // 0.005 ETH
setMintPrice(0)                  // Free (gas only)
```

### 6.2 ETH to Wei converter

| ETH | Wei |
|-----|-----|
| 0.0001 | 100000000000000 |
| 0.0005 | 500000000000000 |
| 0.001 | 1000000000000000 |
| 0.005 | 5000000000000000 |
| 0.01 | 10000000000000000 |

---

## Step 7: Configure Anti-Bot Settings

### 7.1 Anti-Bot Modes Explained

| Mode | Value | tx.origin | Wallet Limit | Cooldown | Denylist | Smart Wallet |
|------|-------|-----------|--------------|----------|----------|--------------|
| DISABLED | 0 | ❌ | ❌ | ❌ | ❌ | ✅ Compatible |
| SOFT | 1 | ❌ | ❌ | ❌ | ✅ | ✅ Compatible |
| MODERATE | 2 | ❌ | ✅ | ✅ | ✅ | ✅ Compatible |
| STRICT | 3 | ✅ | ✅ | ✅ | ✅ | ❌ BLOCKS Smart Wallets |
| CUSTOM | 4 | Configurable | Configurable | Configurable | Configurable | Depends |

### 7.2 Recommended settings by use case

**For Games with Base App/Farcaster (RECOMMENDED):**
```solidity
// Default MODERATE mode is already set
// Keeps: wallet limit (10), cooldown (2 blocks), denylist
// Skips: tx.origin check (would block smart wallets)
```

**For maximum compatibility (minimal protection):**
```solidity
setAntiBotMode(0, false)  // DISABLED mode, no tx.origin check
```

**For maximum protection (blocks smart wallets):**
```solidity
setAntiBotMode(3, true)   // STRICT mode WITH tx.origin check
// ⚠️ WARNING: This blocks Base App, Coinbase Smart Wallet, and Farcaster Frames!
```

### 7.3 Adjust individual settings

```solidity
// Change wallet mint limit
setWalletMintLimit(20)     // Allow 20 mints per wallet (0 = unlimited)

// Change cooldown between mints
setMintCooldown(5)         // 5 blocks between mints (~10 seconds on Base)

// Enable/disable allowlist
setAllowlistEnabled(true)  // Only allowlisted wallets can mint
addToAllowlist(0x...)      // Add wallet to allowlist

// Enable/disable denylist
setDenylistEnabled(true)
addToDenylist(0x...)       // Block specific wallet
removeFromDenylist(0x...)  // Unblock wallet
```

---

## Step 8: Configure Signature Verification

### 8.1 Why signatures matter

Signatures prevent:
- ❌ Bot minting
- ❌ Replay attacks
- ❌ Unauthorized mints
- ❌ Frontend bypassing

### 8.2 Set your backend signer

```solidity
// Set the address that will sign mint authorizations
setSignatureSigner(0xYourBackendSignerAddress)
```

### 8.3 Configure signature expiration

```solidity
// Signatures expire after this many seconds (0 = never expire)
setSignatureExpiration(3600)   // 1 hour (recommended)
setSignatureExpiration(300)    // 5 minutes (stricter)
setSignatureExpiration(0)      // Never expire (not recommended)
```

### 8.4 Disable signature requirement (for testing only)

```solidity
// ⚠️ WARNING: Only for testing! Anyone can mint without verification
setSignatureRequired(false)
```

---

## Step 9: Configure Bonus Claim System

### 9.1 Enable bonus claims

```solidity
// Set claim mode
setClaimMode(3)  // ONE_TIME = each wallet can claim each level once
```

**Claim Modes:**
| Mode | Value | Description |
|------|-------|-------------|
| DISABLED | 0 | No claims allowed |
| FCFS | 1 | First come first served with cap |
| UNLIMITED | 2 | Unlimited claims (careful!) |
| ONE_TIME | 3 | One claim per wallet per level |
| CUSTOM | 4 | Admin-defined rules |

### 9.2 Configure bonus levels

```solidity
// Configure level 1 bonus
configureBonusLevel(
    1,                    // Level ID
    1000000000000000,     // 0.001 ETH bonus
    100                   // 100 claims available (for FCFS mode)
)

// Configure level 5 bonus (harder level, bigger reward)
configureBonusLevel(
    5,                    // Level ID
    5000000000000000,     // 0.005 ETH bonus
    50                    // 50 claims available
)
```

### 9.3 Fund the bonus pool

```solidity
// Deposit ETH for bonus claims
// In Remix: Set "Value" field to amount in wei, then call:
depositBonusFunds()  // Deposits the ETH from Value field
```

### 9.4 Configure eligibility rules

```solidity
// Require level completion proof from backend
setEligibilityRules(
    true,   // checkLevel - requires signed proof of level completion
    false,  // checkScore - don't require minimum score
    false,  // checkNFTOwnership - don't require NFT ownership
    true    // useAndLogic - all checks must pass
)
```

---

## Step 10: Test with Different Wallets

### 10.1 Testing checklist

| Wallet | How to Test | Expected Result |
|--------|-------------|-----------------|
| **MetaMask** | Connect directly | ✅ Should work |
| **Coinbase Wallet** | Mobile app or extension | ✅ Should work |
| **Base App** | Use Base App browser | ✅ Should work (if tx.origin disabled) |
| **Farcaster Frame** | Embed in Farcaster | ✅ Should work (if tx.origin disabled) |

### 10.2 Test mint flow

1. **Check if wallet can mint:**
   ```solidity
   canMint(0xWalletAddress)  // Returns true/false
   ```

2. **Check wallet status:**
   ```solidity
   getWalletMintCount(0xWallet)  // Number of mints
   getLastMintBlock(0xWallet)    // Last mint block
   ```

3. **Test signed mint (from frontend):**
   ```javascript
   // Generate signature on backend, then call:
   await contract.mintWithSignature(
     "ipfs://metadata-uri",
     Math.floor(Date.now() / 1000) + 3600,  // 1 hour expiry
     signature
   );
   ```

---

## Step 11: Frontend Integration

### 11.1 Contract address configuration

Update your frontend environment:
```env
VITE_MEMORYMINT_CONTRACT=0xYourContractAddress
```

### 11.2 Update useNFTMint hook

The contract address should be configured in `src/hooks/useNFTMint.ts`:
```typescript
const MEMORYMINT_CONTRACT = import.meta.env.VITE_MEMORYMINT_CONTRACT 
  || "0xYourFallbackAddress";
```

### 11.3 Backend signature generation

Create an edge function or API endpoint to generate mint signatures:

```typescript
// supabase/functions/sign-mint/index.ts
import { ethers } from 'ethers';

const SIGNER_PRIVATE_KEY = Deno.env.get('MINT_SIGNER_PRIVATE_KEY');

async function signMintRequest(walletAddress: string) {
  const expiration = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  
  const message = ethers.solidityPackedKeccak256(
    ['address', 'uint256'],
    [walletAddress, expiration]
  );
  
  const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);
  const signature = await wallet.signMessage(ethers.getBytes(message));
  
  return { expiration, signature };
}
```

---

## Step 12: Wallet-Specific Considerations

### 12.1 MetaMask

- ✅ Works out of the box
- ✅ Standard EOA transactions
- ✅ All anti-bot modes work

### 12.2 Coinbase Wallet

- ✅ Works with MODERATE mode (default)
- ⚠️ STRICT mode may block some features
- ✅ Supports `wallet_sendCalls` for batched transactions

### 12.3 Base App (Coinbase Smart Wallet)

- ✅ Works with MODERATE mode (default)
- ❌ STRICT mode with `txOriginCheck=true` **BLOCKS** smart wallets
- ✅ Supports sponsored (gasless) transactions

**Critical:** Keep `txOriginCheck = false` for Base App compatibility!

### 12.4 Farcaster Frames

- ✅ Works with MODERATE mode (default)
- ❌ STRICT mode blocks Frames
- ✅ Uses smart wallet under the hood

---

## Emergency Controls

### Pause minting (stops all mints)
```solidity
pause()    // Stop all minting
unpause()  // Resume minting
```

### Disable minting permanently
```solidity
setEmergencyMintDisabled(true)  // Cannot be undone!
```

### Withdraw funds
```solidity
withdraw()  // Withdraw all ETH to owner
```

---

## Gas Estimates (Base Mainnet)

| Operation | Estimated Gas | Cost @ 0.001 gwei |
|-----------|---------------|-------------------|
| Deploy | ~2,500,000 | ~0.0025 ETH |
| mintWithSignature | ~120,000 | ~0.00012 ETH |
| mintNFT (no sig) | ~100,000 | ~0.0001 ETH |
| claimBonus | ~80,000 | ~0.00008 ETH |
| setMintPrice | ~30,000 | ~0.00003 ETH |
| setAntiBotMode | ~50,000 | ~0.00005 ETH |

---

## Troubleshooting

### "Bot Detected" error
- Check `txOriginCheck` setting
- Ensure wallet is not on denylist
- Wait for cooldown to pass

### "Invalid Signature" error
- Verify signer address matches `signatureSigner()`
- Check signature expiration
- Ensure message format matches contract expectation

### "Wallet Limit Exceeded" error
- Increase limit: `setWalletMintLimit(higher_number)`
- Or set to unlimited: `setWalletMintLimit(0)`

### Smart Wallet blocked
- Check `antiBotMode` (should be MODERATE or lower)
- Verify `txOriginCheck = false`
- Run: `setAntiBotMode(2, false)` to fix

### Base App not working
- Ensure `txOriginCheck = false`
- Use MODERATE mode: `setAntiBotMode(2, false)`

---

## ✅ Deployment Complete!

Your MemoryMintUltraSafe contract is now:
- ✅ Deployed on Base Mainnet
- ✅ Configured with safe defaults
- ✅ Compatible with all wallet types
- ✅ Ready for frontend integration

---

## Quick Admin Reference

```solidity
// Common admin tasks
setMintPrice(wei)                    // Set price
setSignatureSigner(address)          // Change signer
setAntiBotMode(mode, txCheck)        // Change protection
setWalletMintLimit(limit)            // Change limit
setMintCooldown(blocks)              // Change cooldown
addToDenylist(address)               // Block wallet
removeFromDenylist(address)          // Unblock wallet
setBaseURI(string)                   // Update metadata
withdraw()                           // Get funds
pause() / unpause()                  // Emergency stop
```

---

## Support

- Contract: `contracts/remix/MemoryMintUltraSafe.sol`
- Documentation: `contracts/remix/DEPLOYMENT_ULTRASAFE.md`
- Issues: Check BaseScan transaction logs for error details

---

**← Back to [Part 1: Preparation & Contract Setup](./DEPLOYMENT_GUIDE_PART1.md)**
