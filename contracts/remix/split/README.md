# MemoryMintUltraSafe v4 - Split Contract Files

Split contract files for Remix IDE deployment. All files must be compiled together.

## File Structure

| File | Description | Lines |
|------|-------------|-------|
| `1_Interfaces.sol` | IERC721Receiver, IERC20 interfaces | ~25 |
| `2_ErrorsEnumsStructs.sol` | Custom errors, enums, structs | ~95 |
| `3_Storage.sol` | All state variables and constants | ~95 |
| `4_BaseLogic.sol` | Modifiers, events, ERC-721 core functions | ~200 |
| `5_FeatureCore.sol` | Anti-bot, signature verification, USDC handling | ~165 |
| `6_Minting.sol` | Mint functions (ETH/USDC with/without signature) | ~115 |
| `7_BonusClaim.sol` | Claim bonus system with eligibility checks | ~160 |
| `8_FinalContract.sol` | Admin functions, view functions, constructor | ~400 |

**Total: ~1,255 lines**

## Deployment in Remix

### Step 1: Upload All Files
Upload all 8 files to Remix IDE in the same folder.

### Step 2: Compiler Settings
- Compiler: 0.8.20+
- EVM Version: paris
- Optimization: Enabled (200 runs)

### Step 3: Deploy
1. Open `8_FinalContract.sol`
2. Compile (all files will compile together via imports)
3. Select `MemoryMintUltraSafe` contract
4. Deploy with constructor parameters:
   - `name_`: "MemoryMint Animal Cards"
   - `symbol_`: "MMANIMAL"
   - `baseURI_`: "ipfs://YOUR_CID/"

## v4 Security Fixes

1. **Nonce-based replay protection** - Prevents signature reuse
2. **Fixed signature expiration** - Proper [now, now+max] window validation
3. **Smart wallet compatible** - receive() allows contract deposits
4. **Duplicate prevention** - activeLevelIds array integrity
5. **Zero-amount validation** - Prevents empty deposits/withdrawals
6. **Level proof in canClaim()** - Optional proof validation for view function

## Contract Inheritance Chain

```
1_Interfaces.sol
       ↓
2_ErrorsEnumsStructs.sol
       ↓
3_Storage.sol (imports 2)
       ↓
4_BaseLogic.sol (imports 3, 1)
       ↓
5_FeatureCore.sol (imports 4)
       ↓
6_Minting.sol (imports 5)
       ↓
7_BonusClaim.sol (imports 6)
       ↓
8_FinalContract.sol (imports 7)
```

## Post-Deploy Configuration

After deployment, configure:

```solidity
// Set signature signer (if different from deployer)
setSignatureSigner(BACKEND_SIGNER_ADDRESS);

// Configure bonus levels
configureBonusLevel(1, 0.001 ether, 0, true, 100, 0, false);

// Enable claims
setClaimMode(3); // ONE_TIME

// Deposit bonus funds
depositBonusFundsETH{value: 0.1 ether}();
```

## Mini-Game Integration

The contract is fully compatible with the MemoryMint mini-game frontend hooks:
- `useNFTMint.ts` - For minting with signature
- `useSIWEAuth.ts` - For wallet authentication
- `useNFTCollection.ts` - For viewing minted NFTs

### Signature Format (v4)

```javascript
// Frontend must get nonce first
const nonce = await contract.getNonce(walletAddress);

// Backend generates signature with nonce
const messageHash = ethers.solidityPackedKeccak256(
  ['address', 'uint256', 'address', 'uint256', 'uint256'],
  [walletAddress, nonce, contractAddress, chainId, expiration]
);
```
