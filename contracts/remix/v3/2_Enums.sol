// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMint Ultra V3 - Enums & Structs
 * @notice Part 2/8 - All enumerations and data structures
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @dev Claim modes for bonus distribution
 */
enum ClaimMode {
    DISABLED,           // No claims allowed
    FCFS,              // First-come-first-served
    MERKLE,            // Merkle proof required
    SIGNATURE,         // Signature verification
    ALLOWLIST          // Allowlist only
}

/**
 * @dev Anti-bot protection levels
 */
enum AntiBotMode {
    DISABLED,          // No protection
    COOLDOWN_ONLY,     // Time-based cooldown
    SIGNATURE_ONLY,    // Signature required
    ALLOWLIST_ONLY,    // Allowlist required
    FULL               // All protections active
}

/**
 * @dev Supported payment currencies
 */
enum PaymentCurrency {
    ETH,
    USDC
}

/**
 * @dev Resolution priority for dynamic pricing/bonuses
 */
enum ResolutionPriority {
    LEVEL_ONLY,        // Use level-based values only
    SUPPLY_ONLY,       // Use supply-based values only
    SUPPLY_OVERRIDES,  // Supply takes priority over level
    LEVEL_OVERRIDES    // Level takes priority over supply
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE STRUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @dev Bonus configuration for claim system
 */
struct BonusConfig {
    uint256 bonusAmountETH;
    uint256 bonusAmountUSDC;
    uint256 minMintCount;
    uint256 minHoldDuration;
    bool isActive;
}

/**
 * @dev Per-wallet tracking data
 */
struct WalletData {
    uint256 mintCount;
    uint256 lastMintTime;
    uint256 claimCount;
    uint256 lastClaimTime;
    uint256 totalBonusClaimed;
    bool isAllowlisted;
}

/**
 * @dev Eligibility rules for claims
 */
struct EligibilityRules {
    uint256 minMintCount;
    uint256 minHoldDuration;
    uint256 claimCooldown;
    bool requireAllowlist;
    bool requireSignature;
}

/**
 * @dev Currency configuration
 */
struct CurrencyConfig {
    bool ethEnabled;
    bool usdcEnabled;
    PaymentCurrency activeCurrency;
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3 DYNAMIC PRICING STRUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @dev Dynamic pricing configuration
 */
struct DynamicPricingConfig {
    bool enabled;
    ResolutionPriority priority;
    uint8 activeLevelCount;
    uint8 activeSupplyTierCount;
}

/**
 * @dev Level-based pricing (1-20)
 */
struct LevelPrice {
    uint256 priceETH;
    uint256 priceUSDC;
    bool isActive;
}

/**
 * @dev Supply-threshold pricing tier
 */
struct SupplyTier {
    uint256 minSupply;
    uint256 maxSupply;      // 0 = infinite (applies forever)
    uint256 priceETH;
    uint256 priceUSDC;
    bool isActive;
}

// ═══════════════════════════════════════════════════════════════════════════════
// V3 DYNAMIC BONUS STRUCTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @dev Dynamic bonus configuration
 */
struct DynamicBonusConfig {
    bool enabled;
    ResolutionPriority priority;
    uint8 activeLevelCount;
    uint8 activeSupplyTierCount;
}

/**
 * @dev Level-based bonus (1-20)
 */
struct LevelBonus {
    uint256 bonusETH;
    uint256 bonusUSDC;
    bool isActive;
}

/**
 * @dev Supply-threshold bonus tier
 */
struct SupplyBonusTier {
    uint256 minSupply;
    uint256 maxSupply;      // 0 = infinite
    uint256 bonusETH;
    uint256 bonusUSDC;
    bool isActive;
}
