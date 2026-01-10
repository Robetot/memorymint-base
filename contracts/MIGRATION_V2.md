# MemoryMintUltraV2 Migration Guide

## Overview

MemoryMintUltraV2 is a **complete upgrade** from MemoryMintUltra that adds all previously unsupported admin features while maintaining full backward compatibility.

**Target Chain:** Base Mainnet (chainId 8453)

---

## 🆕 New Features Summary

| Feature | Function(s) | Status |
|---------|-------------|--------|
| Wallet Mint Limits | `setWalletMintLimit(uint256)` | ✅ On-chain enforced |
| Paid Minting (ETH) | `setMintPriceETH(uint256)` | ✅ On-chain enforced |
| Paid Minting (USDC) | `setMintPriceUSDC(uint256)` | ✅ On-chain enforced |
| Mint Currency Switch | `setMintCurrency(uint8)` | ✅ On-chain enforced |
| Bonus System | `setBonusLevel(...)`, `claimBonus(...)` | ✅ On-chain enforced |
| Bonus Pool (ETH) | `depositETH()`, `withdrawETH(...)` | ✅ On-chain enforced |
| Bonus Pool (USDC) | `depositUSDC(...)`, `withdrawUSDC(...)` | ✅ On-chain enforced |
| Global Kill Switch | `emergencyStop(bool)` | ✅ On-chain enforced |

---

## 🔄 Backward Compatibility

### ✅ Preserved From V1

| Feature | Notes |
|---------|-------|
| Token IDs | Start from 1, no reset |
| Ownership | Owner address unchanged |
| Free minting | Works when price = 0 |
| `mintNFT()` | Same signature, now payable |
| `mintGameNFT()` | Same signature, now payable |
| `batchMint()` | Same signature, now payable |
| `pause()` / `unpause()` | Unchanged |
| `setThrottle()` | Unchanged |
| All ERC-721 functions | Fully compliant |
| Player data | Unchanged structure |
| NFT metadata | Unchanged structure |

### 🔁 Changed Behavior

| Function | V1 | V2 |
|----------|-----|-----|
| `mintNFT()` | Free only | Free or paid based on `mintPriceETH`/`mintPriceUSDC` |
| `mintGameNFT()` | Free only | Free or paid based on `mintPriceETH`/`mintPriceUSDC` |
| `batchMint()` | Free only | Free or paid, multiplied by quantity |

---

## 📊 Admin Panel → Contract Mapping

| Admin Panel Feature | Contract Function | Parameters |
|---------------------|-------------------|------------|
| **Mint Controls** | | |
| Mint Enabled | `pause()` / `unpause()` | none |
| Free Mint Toggle | `setMintPriceETH(0)` | price = 0 for free |
| Mint Price (ETH) | `setMintPriceETH(uint256)` | price in wei |
| Mint Price (USDC) | `setMintPriceUSDC(uint256)` | price in 6 decimals |
| Currency Selector | `setMintCurrency(uint8)` | 0 = ETH, 1 = USDC |
| Throttle | `setThrottle(bool)` | enabled |
| **Anti-Bot** | | |
| Wallet Mint Limit | `setWalletMintLimit(uint256)` | 0 = unlimited |
| Wallet Mint Count | `walletMintCount(address)` | view |
| **Emergency** | | |
| Emergency Stop | `emergencyStop(bool)` | true = stop all |
| Kill Switch Status | `killSwitch()` | view |
| **Bonus System** | | |
| Configure Level | `setBonusLevel(uint8,bool,uint8,uint256)` | level, enabled, currency, amount |
| Level 4 Config | `bonusLevels(4)` | view |
| Level 8 Config | `bonusLevels(8)` | view |
| Level 12 Config | `bonusLevels(12)` | view |
| Level 16 Config | `bonusLevels(16)` | view |
| Level 20 Config | `bonusLevels(20)` | view |
| Claim Bonus | `claimBonus(uint8)` | level |
| Check Claimed | `hasClaimed(address,uint8)` | wallet, level |
| **Bonus Pools** | | |
| ETH Pool Balance | `bonusPoolETH()` | view |
| USDC Pool Balance | `bonusPoolUSDC()` | view |
| Deposit ETH | `depositETH()` | payable |
| Deposit USDC | `depositUSDC(uint256)` | amount (requires approval) |
| Withdraw ETH | `withdrawETH(uint256)` | amount (owner only) |
| Withdraw USDC | `withdrawUSDC(uint256)` | amount (owner only) |
| **Fee Collection** | | |
| Withdraw Fees | `withdrawMintFees()` | owner only |

---

## ⛽ Gas Impact Summary

### New Storage Variables

| Variable | Type | Slot Impact |
|----------|------|-------------|
| `killSwitch` | bool | Packed with existing |
| `walletMintLimit` | uint256 | 1 slot |
| `walletMintCount` | mapping | Dynamic |
| `mintPriceETH` | uint256 | 1 slot |
| `mintPriceUSDC` | uint256 | 1 slot |
| `mintCurrency` | uint8 | Packed |
| `bonusLevels` | mapping | Dynamic |
| `bonusClaimed` | mapping | Dynamic |
| `bonusPoolETH` | uint256 | 1 slot |
| `bonusPoolUSDC` | uint256 | 1 slot |

### Gas Estimates (Base Mainnet)

| Function | Estimated Gas | Notes |
|----------|---------------|-------|
| `mintNFT()` (free) | ~85,000 | Similar to V1 |
| `mintNFT()` (ETH) | ~87,000 | +value transfer |
| `mintNFT()` (USDC) | ~110,000 | +ERC20 transfer |
| `setWalletMintLimit()` | ~30,000 | Admin only |
| `setBonusLevel()` | ~45,000 | Admin only |
| `claimBonus()` (ETH) | ~55,000 | Includes transfer |
| `claimBonus()` (USDC) | ~75,000 | Includes ERC20 |
| `depositETH()` | ~25,000 | Simple |
| `depositUSDC()` | ~65,000 | ERC20 transfer |
| `emergencyStop()` | ~28,000 | Admin only |

---

## 🛡️ Security Considerations

### Reentrancy Protection

All functions that transfer value use:
- `nonReentrant` modifier
- CEI pattern (Checks-Effects-Interactions)

### Owner-Only Functions

| Function | Restriction |
|----------|-------------|
| `setWalletMintLimit()` | ✅ onlyOwner |
| `setMintPriceETH()` | ✅ onlyOwner |
| `setMintPriceUSDC()` | ✅ onlyOwner |
| `setMintCurrency()` | ✅ onlyOwner |
| `setBonusLevel()` | ✅ onlyOwner |
| `withdrawETH()` | ✅ onlyOwner |
| `withdrawUSDC()` | ✅ onlyOwner |
| `emergencyStop()` | ✅ onlyOwner |
| `withdrawMintFees()` | ✅ onlyOwner |

### Kill Switch Behavior

When `emergencyStop(true)`:
- ❌ No minting (all functions revert)
- ❌ No bonus claims (reverts)
- ✅ Transfers still work (ERC-721 compliance)
- ✅ Admin functions still work
- ✅ View functions still work

---

## 🚀 Deployment Instructions

### 1. Compile

```bash
solc --optimize --optimize-runs 200 --evm-version paris \
  contracts/MemoryMintUltraV2.sol -o build/
```

### 2. Deploy (Remix)

1. Open Remix IDE
2. Create new file: `MemoryMintUltraV2.sol`
3. Paste contract code
4. Compile with:
   - Compiler: 0.8.20
   - Optimizer: 200 runs
   - EVM: paris
5. Deploy with constructor args:
   - `name_`: "MemoryMint"
   - `symbol_`: "MMINT"
6. Verify on Basescan

### 3. Post-Deployment Setup

```javascript
// 1. Verify ownership
await contract.owner(); // Should be deployer

// 2. Set safe defaults (already set in constructor)
// - walletMintLimit: 0 (unlimited)
// - mintPriceETH: 0 (free)
// - killSwitch: false

// 3. Fund bonus pools if needed
await contract.depositETH({ value: parseEther("1.0") });
await usdc.approve(contract.address, parseUnits("1000", 6));
await contract.depositUSDC(parseUnits("1000", 6));

// 4. Configure bonus levels
await contract.setBonusLevel(4, true, 0, parseEther("0.001"));  // Level 4, ETH
await contract.setBonusLevel(8, true, 0, parseEther("0.002"));  // Level 8, ETH
await contract.setBonusLevel(12, true, 1, parseUnits("1", 6)); // Level 12, USDC
```

---

## ⚠️ Breaking Changes

**None** - V2 is fully backward compatible with V1.

All existing:
- NFTs remain valid
- Token URIs work
- Player data preserved
- Transfers work
- Approvals work

---

## 📋 Checklist for Frontend Update

- [ ] Update contract ABI to V2
- [ ] Update contract address after deployment
- [ ] Add `setWalletMintLimit()` call support
- [ ] Add `setMintPriceETH()` call support
- [ ] Add `setMintPriceUSDC()` call support
- [ ] Add `setMintCurrency()` call support
- [ ] Add `setBonusLevel()` call support
- [ ] Add `claimBonus()` call support
- [ ] Add `depositETH()` call support
- [ ] Add `depositUSDC()` call support (with USDC approval flow)
- [ ] Add `withdrawETH()` call support
- [ ] Add `withdrawUSDC()` call support
- [ ] Add `emergencyStop()` call support
- [ ] Add bonus pool balance display
- [ ] Add wallet mint count display
- [ ] Handle `KillSwitchActive` error
- [ ] Handle `WalletMintLimitExceeded` error
- [ ] Handle `InsufficientBonusPool` error
- [ ] Handle USDC approval/balance errors
