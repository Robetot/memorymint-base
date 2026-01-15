// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintDynamicPricing
 * @author MemoryMint Team
 * @notice ADD-ON module for dynamic mint pricing and bonus resolution
 * @dev This file contains ONLY the new storage, structs, events, and functions
 *      to be APPENDED to MemoryMintUltraV2 or MemoryMintUltraSafe.
 * 
 * INTEGRATION INSTRUCTIONS:
 * 1. Copy all content below "=== ADD-ON STORAGE ===" into your existing contract
 * 2. Place new storage variables AFTER existing storage (maintains storage layout)
 * 3. Add new functions AFTER existing functions
 * 4. Do NOT modify any existing code
 * 
 * FEATURES:
 * - Dynamic mint pricing by level (1-20) or supply thresholds
 * - Dynamic claim bonuses by level (1-20) or supply thresholds  
 * - Admin-controlled resolution priority
 * - Backward compatible: disabled by default, existing logic unchanged
 * - ETH + USDC support
 * - Gas-efficient: no loops over totalMinted
 */

// ============ NEW CUSTOM ERRORS (APPEND) ============

error DynamicPricingDisabled();
error DynamicBonusDisabled();
error InvalidLevel();               // Level must be 1-20
error InvalidSupplyTier();
error TierLimitExceeded();         // Max 20 supply tiers
error LevelLimitExceeded();        // Max 20 levels
error InvalidResolutionPriority();
error PriceResolutionFailed();
error BonusResolutionFailed();

// ============ NEW ENUMS (APPEND) ============

/**
 * @notice Resolution priority for dynamic pricing/bonuses
 * @dev Admin selects how level-based and supply-based values are resolved
 */
enum ResolutionPriority {
    LEVEL_ONLY,           // Only use level-based values
    SUPPLY_ONLY,          // Only use supply-threshold values
    SUPPLY_OVERRIDES,     // Try supply first, fallback to level
    LEVEL_OVERRIDES       // Try level first, fallback to supply
}

// ============ NEW STRUCTS (APPEND) ============

/**
 * @notice Level-based pricing configuration (levels 1-20)
 */
struct LevelPrice {
    uint256 priceETH;     // Price in wei
    uint256 priceUSDC;    // Price in USDC (6 decimals)
    bool active;          // Whether this level is configured
}

/**
 * @notice Supply-threshold pricing tier
 * @dev maxSupply of 0 means infinite (applies forever after minSupply)
 */
struct SupplyTier {
    uint256 minSupply;    // Minimum totalMinted for this tier
    uint256 maxSupply;    // Maximum totalMinted (0 = infinite)
    uint256 priceETH;     // Price in wei
    uint256 priceUSDC;    // Price in USDC (6 decimals)
    bool enabled;         // Whether this tier is active
}

/**
 * @notice Level-based bonus configuration (levels 1-20)
 */
struct LevelBonus {
    uint256 bonusETH;     // Bonus amount in wei
    uint256 bonusUSDC;    // Bonus amount in USDC (6 decimals)
    bool active;          // Whether this level bonus is configured
}

/**
 * @notice Supply-threshold bonus tier
 */
struct SupplyBonusTier {
    uint256 minSupply;    // Minimum totalMinted for this tier
    uint256 maxSupply;    // Maximum totalMinted (0 = infinite)
    uint256 bonusETH;     // Bonus in wei
    uint256 bonusUSDC;    // Bonus in USDC (6 decimals)
    bool enabled;         // Whether this tier is active
}

/**
 * @notice Dynamic pricing system configuration
 */
struct DynamicPricingConfig {
    bool enabled;                          // Master switch for dynamic pricing
    ResolutionPriority resolutionPriority; // How to resolve prices
    uint8 levelCount;                      // Number of configured levels (max 20)
    uint8 supplyTierCount;                 // Number of configured supply tiers (max 20)
}

/**
 * @notice Dynamic bonus system configuration
 */
struct DynamicBonusConfig {
    bool enabled;                          // Master switch for dynamic bonuses
    ResolutionPriority resolutionPriority; // How to resolve bonuses
    uint8 levelCount;                      // Number of configured levels (max 20)
    uint8 supplyTierCount;                 // Number of configured supply tiers (max 20)
}

// ============================================================================
// === ADD-ON STORAGE (APPEND AFTER EXISTING STORAGE) ========================
// ============================================================================

/*
    IMPORTANT: Add these variables AFTER your existing storage variables.
    Do NOT change existing variable order or types.
    
    // ============ DYNAMIC PRICING STORAGE (V3 ADD-ON) ============
    
    DynamicPricingConfig public dynamicPricing;
    mapping(uint8 => LevelPrice) public levelPrices;        // level (1-20) => price config
    mapping(uint8 => SupplyTier) public supplyPriceTiers;   // tierIndex (0-19) => tier config
    
    DynamicBonusConfig public dynamicBonus;
    mapping(uint8 => LevelBonus) public levelBonuses;       // level (1-20) => bonus config
    mapping(uint8 => SupplyBonusTier) public supplyBonusTiers; // tierIndex (0-19) => tier config
*/

// ============================================================================
// === ADD-ON EVENTS (APPEND AFTER EXISTING EVENTS) ==========================
// ============================================================================

/*
    // Dynamic Pricing Events
    event DynamicPricingEnabled(bool enabled);
    event DynamicPricingResolutionUpdated(ResolutionPriority priority);
    event LevelPriceConfigured(uint8 indexed level, uint256 priceETH, uint256 priceUSDC, bool active);
    event SupplyPriceTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool enabled);
    
    // Dynamic Bonus Events
    event DynamicBonusEnabled(bool enabled);
    event DynamicBonusResolutionUpdated(ResolutionPriority priority);
    event LevelBonusConfigured(uint8 indexed level, uint256 bonusETH, uint256 bonusUSDC, bool active);
    event SupplyBonusTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool enabled);
*/

// ============================================================================
// === COMPLETE ADD-ON CONTRACT SECTION ======================================
// ============================================================================
//
// Copy everything below this line into your existing contract.
// Place after all existing functions.
//

/*

    // ============ CONSTANTS (V3) ============
    
    uint8 public constant MAX_LEVELS = 20;
    uint8 public constant MAX_SUPPLY_TIERS = 20;

    // ============ DYNAMIC PRICING STORAGE (V3) ============
    
    DynamicPricingConfig public dynamicPricing;
    mapping(uint8 => LevelPrice) public levelPrices;
    mapping(uint8 => SupplyTier) public supplyPriceTiers;
    
    DynamicBonusConfig public dynamicBonus;
    mapping(uint8 => LevelBonus) public levelBonuses;
    mapping(uint8 => SupplyBonusTier) public supplyBonusTiers;

    // ============ DYNAMIC PRICING EVENTS (V3) ============
    
    event DynamicPricingEnabled(bool enabled);
    event DynamicPricingResolutionUpdated(ResolutionPriority priority);
    event LevelPriceConfigured(uint8 indexed level, uint256 priceETH, uint256 priceUSDC, bool active);
    event SupplyPriceTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool enabled);
    
    event DynamicBonusEnabled(bool enabled);
    event DynamicBonusResolutionUpdated(ResolutionPriority priority);
    event LevelBonusConfigured(uint8 indexed level, uint256 bonusETH, uint256 bonusUSDC, bool active);
    event SupplyBonusTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool enabled);

    // ============================================================================
    // === DYNAMIC PRICING RESOLUTION (INTERNAL) =================================
    // ============================================================================

    /**
     * @notice Resolve dynamic mint price based on current configuration
     * @param level Game level (1-20) for level-based pricing
     * @param currency 0 = ETH, 1 = USDC
     * @return price The resolved mint price
     * @return isDynamic Whether dynamic pricing was used
     */
    function _resolveDynamicMintPrice(uint8 level, uint8 currency) internal view returns (uint256 price, bool isDynamic) {
        // If dynamic pricing is disabled, return 0 and false (use existing static price)
        if (!dynamicPricing.enabled) {
            return (0, false);
        }
        
        ResolutionPriority priority = dynamicPricing.resolutionPriority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelPrice(level, currency);
        } else if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyPrice(currency);
        } else if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            // Try supply first
            (uint256 supplyPrice, bool supplyFound) = _resolveSupplyPrice(currency);
            if (supplyFound) {
                return (supplyPrice, true);
            }
            // Fallback to level
            return _resolveLevelPrice(level, currency);
        } else {
            // LEVEL_OVERRIDES: Try level first
            (uint256 levelPrice, bool levelFound) = _resolveLevelPrice(level, currency);
            if (levelFound) {
                return (levelPrice, true);
            }
            // Fallback to supply
            return _resolveSupplyPrice(currency);
        }
    }
    
    /**
     * @notice Resolve price from level configuration
     */
    function _resolveLevelPrice(uint8 level, uint8 currency) internal view returns (uint256 price, bool found) {
        if (level == 0 || level > MAX_LEVELS) {
            return (0, false);
        }
        
        LevelPrice storage lp = levelPrices[level];
        if (!lp.active) {
            return (0, false);
        }
        
        if (currency == 0) {
            return (lp.priceETH, true);
        } else {
            return (lp.priceUSDC, true);
        }
    }
    
    /**
     * @notice Resolve price from supply tier configuration
     * @dev Uses _totalMinted or _nextTokenId - 1 for current supply
     */
    function _resolveSupplyPrice(uint8 currency) internal view returns (uint256 price, bool found) {
        uint256 currentSupply = _nextTokenId > 0 ? _nextTokenId - 1 : 0;
        
        // Iterate through tiers (max 20, gas-safe)
        for (uint8 i = 0; i < dynamicPricing.supplyTierCount; i++) {
            SupplyTier storage tier = supplyPriceTiers[i];
            if (!tier.enabled) continue;
            
            // Check if current supply falls within this tier
            if (currentSupply >= tier.minSupply) {
                // maxSupply of 0 means infinite (applies forever)
                if (tier.maxSupply == 0 || currentSupply < tier.maxSupply) {
                    if (currency == 0) {
                        return (tier.priceETH, true);
                    } else {
                        return (tier.priceUSDC, true);
                    }
                }
            }
        }
        
        return (0, false);
    }

    // ============================================================================
    // === DYNAMIC BONUS RESOLUTION (INTERNAL) ===================================
    // ============================================================================

    /**
     * @notice Resolve dynamic bonus amount based on current configuration
     * @param level Game level (1-20) for level-based bonuses
     * @param currency 0 = ETH, 1 = USDC
     * @return bonus The resolved bonus amount
     * @return isDynamic Whether dynamic bonus was used
     */
    function _resolveDynamicBonus(uint8 level, uint8 currency) internal view returns (uint256 bonus, bool isDynamic) {
        if (!dynamicBonus.enabled) {
            return (0, false);
        }
        
        ResolutionPriority priority = dynamicBonus.resolutionPriority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelBonus(level, currency);
        } else if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyBonus(currency);
        } else if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            (uint256 supplyBonus, bool supplyFound) = _resolveSupplyBonus(currency);
            if (supplyFound) {
                return (supplyBonus, true);
            }
            return _resolveLevelBonus(level, currency);
        } else {
            (uint256 levelBonus, bool levelFound) = _resolveLevelBonus(level, currency);
            if (levelFound) {
                return (levelBonus, true);
            }
            return _resolveSupplyBonus(currency);
        }
    }
    
    /**
     * @notice Resolve bonus from level configuration
     */
    function _resolveLevelBonus(uint8 level, uint8 currency) internal view returns (uint256 bonus, bool found) {
        if (level == 0 || level > MAX_LEVELS) {
            return (0, false);
        }
        
        LevelBonus storage lb = levelBonuses[level];
        if (!lb.active) {
            return (0, false);
        }
        
        if (currency == 0) {
            return (lb.bonusETH, true);
        } else {
            return (lb.bonusUSDC, true);
        }
    }
    
    /**
     * @notice Resolve bonus from supply tier configuration
     */
    function _resolveSupplyBonus(uint8 currency) internal view returns (uint256 bonus, bool found) {
        uint256 currentSupply = _nextTokenId > 0 ? _nextTokenId - 1 : 0;
        
        for (uint8 i = 0; i < dynamicBonus.supplyTierCount; i++) {
            SupplyBonusTier storage tier = supplyBonusTiers[i];
            if (!tier.enabled) continue;
            
            if (currentSupply >= tier.minSupply) {
                if (tier.maxSupply == 0 || currentSupply < tier.maxSupply) {
                    if (currency == 0) {
                        return (tier.bonusETH, true);
                    } else {
                        return (tier.bonusUSDC, true);
                    }
                }
            }
        }
        
        return (0, false);
    }

    // ============================================================================
    // === PUBLIC VIEW FUNCTIONS (PRICE/BONUS RESOLUTION) ========================
    // ============================================================================

    /**
     * @notice Get the current effective mint price
     * @param level Game level for dynamic resolution (0 to skip level-based)
     * @param currency 0 = ETH, 1 = USDC
     * @return price The effective mint price
     * @return isDynamic Whether dynamic pricing was applied
     */
    function getEffectiveMintPrice(uint8 level, uint8 currency) external view returns (uint256 price, bool isDynamic) {
        (price, isDynamic) = _resolveDynamicMintPrice(level, currency);
        
        // If no dynamic price, use static prices
        if (!isDynamic) {
            if (currency == 0) {
                return (mintPriceETH, false);
            } else {
                return (mintPriceUSDC, false);
            }
        }
        
        return (price, true);
    }
    
    /**
     * @notice Get the current effective claim bonus
     * @param level Game level for dynamic resolution
     * @param currency 0 = ETH, 1 = USDC
     * @return bonus The effective bonus amount
     * @return isDynamic Whether dynamic bonus was applied
     */
    function getEffectiveBonus(uint8 level, uint8 currency) external view returns (uint256 bonus, bool isDynamic) {
        return _resolveDynamicBonus(level, currency);
    }

    /**
     * @notice Get all configured level prices
     * @return levels Array of level numbers (1-20)
     * @return pricesETH Array of ETH prices
     * @return pricesUSDC Array of USDC prices
     * @return activeFlags Array of active flags
     */
    function getAllLevelPrices() external view returns (
        uint8[] memory levels,
        uint256[] memory pricesETH,
        uint256[] memory pricesUSDC,
        bool[] memory activeFlags
    ) {
        uint8 count = dynamicPricing.levelCount;
        levels = new uint8[](count);
        pricesETH = new uint256[](count);
        pricesUSDC = new uint256[](count);
        activeFlags = new bool[](count);
        
        uint8 idx = 0;
        for (uint8 i = 1; i <= MAX_LEVELS && idx < count; i++) {
            if (levelPrices[i].active) {
                levels[idx] = i;
                pricesETH[idx] = levelPrices[i].priceETH;
                pricesUSDC[idx] = levelPrices[i].priceUSDC;
                activeFlags[idx] = true;
                idx++;
            }
        }
    }

    /**
     * @notice Get all configured supply price tiers
     */
    function getAllSupplyPriceTiers() external view returns (
        SupplyTier[] memory tiers
    ) {
        uint8 count = dynamicPricing.supplyTierCount;
        tiers = new SupplyTier[](count);
        
        for (uint8 i = 0; i < count; i++) {
            tiers[i] = supplyPriceTiers[i];
        }
    }

    // ============================================================================
    // === ADMIN: DYNAMIC PRICING CONFIGURATION ==================================
    // ============================================================================

    /**
     * @notice Enable or disable dynamic pricing system
     * @dev When disabled, existing mintPriceETH/mintPriceUSDC are used
     */
    function setDynamicPricingEnabled(bool enabled) external onlyOwner {
        dynamicPricing.enabled = enabled;
        emit DynamicPricingEnabled(enabled);
    }
    
    /**
     * @notice Set resolution priority for dynamic pricing
     * @param priority How level vs supply-based prices are resolved
     */
    function setDynamicPricingResolution(ResolutionPriority priority) external onlyOwner {
        if (uint8(priority) > 3) revert InvalidResolutionPriority();
        dynamicPricing.resolutionPriority = priority;
        emit DynamicPricingResolutionUpdated(priority);
    }
    
    /**
     * @notice Configure price for a specific level (1-20)
     * @param level Game level (1-20)
     * @param priceETH Price in wei
     * @param priceUSDC Price in USDC (6 decimals)
     * @param active Whether this level price is active
     */
    function setLevelPrice(uint8 level, uint256 priceETH, uint256 priceUSDC, bool active) external onlyOwner {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        
        bool wasActive = levelPrices[level].active;
        levelPrices[level] = LevelPrice({
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            active: active
        });
        
        // Update level count
        if (active && !wasActive) {
            if (dynamicPricing.levelCount < MAX_LEVELS) {
                unchecked { dynamicPricing.levelCount++; }
            }
        } else if (!active && wasActive && dynamicPricing.levelCount > 0) {
            unchecked { dynamicPricing.levelCount--; }
        }
        
        emit LevelPriceConfigured(level, priceETH, priceUSDC, active);
    }
    
    /**
     * @notice Batch configure level prices
     * @param levels Array of levels (1-20)
     * @param pricesETH Array of ETH prices
     * @param pricesUSDC Array of USDC prices
     * @param activeFlags Array of active flags
     */
    function batchSetLevelPrices(
        uint8[] calldata levels,
        uint256[] calldata pricesETH,
        uint256[] calldata pricesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != pricesETH.length || len != pricesUSDC.length || len != activeFlags.length) {
            revert InvalidQuantity();
        }
        if (len > MAX_LEVELS) revert LevelLimitExceeded();
        
        for (uint256 i = 0; i < len;) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            
            bool wasActive = levelPrices[level].active;
            levelPrices[level] = LevelPrice({
                priceETH: pricesETH[i],
                priceUSDC: pricesUSDC[i],
                active: activeFlags[i]
            });
            
            if (activeFlags[i] && !wasActive && dynamicPricing.levelCount < MAX_LEVELS) {
                unchecked { dynamicPricing.levelCount++; }
            } else if (!activeFlags[i] && wasActive && dynamicPricing.levelCount > 0) {
                unchecked { dynamicPricing.levelCount--; }
            }
            
            emit LevelPriceConfigured(level, pricesETH[i], pricesUSDC[i], activeFlags[i]);
            unchecked { i++; }
        }
    }
    
    /**
     * @notice Add or update a supply-based price tier
     * @param tierIndex Index (0-19)
     * @param minSupply Minimum totalMinted for this tier
     * @param maxSupply Maximum totalMinted (0 = infinite)
     * @param priceETH Price in wei
     * @param priceUSDC Price in USDC (6 decimals)
     * @param enabled Whether tier is active
     */
    function setSupplyPriceTier(
        uint8 tierIndex,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool enabled
    ) external onlyOwner {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidSupplyTier();
        
        bool wasEnabled = supplyPriceTiers[tierIndex].enabled;
        supplyPriceTiers[tierIndex] = SupplyTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            enabled: enabled
        });
        
        // Update tier count
        if (enabled && !wasEnabled && dynamicPricing.supplyTierCount < MAX_SUPPLY_TIERS) {
            if (tierIndex >= dynamicPricing.supplyTierCount) {
                dynamicPricing.supplyTierCount = tierIndex + 1;
            }
        }
        
        emit SupplyPriceTierConfigured(tierIndex, minSupply, maxSupply, priceETH, priceUSDC, enabled);
    }

    // ============================================================================
    // === ADMIN: DYNAMIC BONUS CONFIGURATION ====================================
    // ============================================================================

    /**
     * @notice Enable or disable dynamic bonus system
     * @dev When disabled, existing bonus logic is used
     */
    function setDynamicBonusEnabled(bool enabled) external onlyOwner {
        dynamicBonus.enabled = enabled;
        emit DynamicBonusEnabled(enabled);
    }
    
    /**
     * @notice Set resolution priority for dynamic bonuses
     */
    function setDynamicBonusResolution(ResolutionPriority priority) external onlyOwner {
        if (uint8(priority) > 3) revert InvalidResolutionPriority();
        dynamicBonus.resolutionPriority = priority;
        emit DynamicBonusResolutionUpdated(priority);
    }
    
    /**
     * @notice Configure bonus for a specific level (1-20)
     * @param level Game level (1-20)
     * @param bonusETH Bonus in wei
     * @param bonusUSDC Bonus in USDC (6 decimals)
     * @param active Whether this level bonus is active
     */
    function setLevelBonus(uint8 level, uint256 bonusETH, uint256 bonusUSDC, bool active) external onlyOwner {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        
        bool wasActive = levelBonuses[level].active;
        levelBonuses[level] = LevelBonus({
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            active: active
        });
        
        if (active && !wasActive && dynamicBonus.levelCount < MAX_LEVELS) {
            unchecked { dynamicBonus.levelCount++; }
        } else if (!active && wasActive && dynamicBonus.levelCount > 0) {
            unchecked { dynamicBonus.levelCount--; }
        }
        
        emit LevelBonusConfigured(level, bonusETH, bonusUSDC, active);
    }
    
    /**
     * @notice Batch configure level bonuses
     */
    function batchSetLevelBonuses(
        uint8[] calldata levels,
        uint256[] calldata bonusesETH,
        uint256[] calldata bonusesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != bonusesETH.length || len != bonusesUSDC.length || len != activeFlags.length) {
            revert InvalidQuantity();
        }
        if (len > MAX_LEVELS) revert LevelLimitExceeded();
        
        for (uint256 i = 0; i < len;) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            
            bool wasActive = levelBonuses[level].active;
            levelBonuses[level] = LevelBonus({
                bonusETH: bonusesETH[i],
                bonusUSDC: bonusesUSDC[i],
                active: activeFlags[i]
            });
            
            if (activeFlags[i] && !wasActive && dynamicBonus.levelCount < MAX_LEVELS) {
                unchecked { dynamicBonus.levelCount++; }
            } else if (!activeFlags[i] && wasActive && dynamicBonus.levelCount > 0) {
                unchecked { dynamicBonus.levelCount--; }
            }
            
            emit LevelBonusConfigured(level, bonusesETH[i], bonusesUSDC[i], activeFlags[i]);
            unchecked { i++; }
        }
    }
    
    /**
     * @notice Add or update a supply-based bonus tier
     */
    function setSupplyBonusTier(
        uint8 tierIndex,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool enabled
    ) external onlyOwner {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidSupplyTier();
        
        bool wasEnabled = supplyBonusTiers[tierIndex].enabled;
        supplyBonusTiers[tierIndex] = SupplyBonusTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            enabled: enabled
        });
        
        if (enabled && !wasEnabled && dynamicBonus.supplyTierCount < MAX_SUPPLY_TIERS) {
            if (tierIndex >= dynamicBonus.supplyTierCount) {
                dynamicBonus.supplyTierCount = tierIndex + 1;
            }
        }
        
        emit SupplyBonusTierConfigured(tierIndex, minSupply, maxSupply, bonusETH, bonusUSDC, enabled);
    }

    // ============================================================================
    // === VIEW: CONFIGURATION STATUS ============================================
    // ============================================================================

    /**
     * @notice Get dynamic pricing configuration
     */
    function getDynamicPricingConfig() external view returns (
        bool enabled,
        ResolutionPriority resolutionPriority,
        uint8 levelCount,
        uint8 supplyTierCount
    ) {
        return (
            dynamicPricing.enabled,
            dynamicPricing.resolutionPriority,
            dynamicPricing.levelCount,
            dynamicPricing.supplyTierCount
        );
    }
    
    /**
     * @notice Get dynamic bonus configuration
     */
    function getDynamicBonusConfig() external view returns (
        bool enabled,
        ResolutionPriority resolutionPriority,
        uint8 levelCount,
        uint8 supplyTierCount
    ) {
        return (
            dynamicBonus.enabled,
            dynamicBonus.resolutionPriority,
            dynamicBonus.levelCount,
            dynamicBonus.supplyTierCount
        );
    }
    
    /**
     * @notice Get level price configuration
     */
    function getLevelPrice(uint8 level) external view returns (uint256 priceETH, uint256 priceUSDC, bool active) {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        LevelPrice storage lp = levelPrices[level];
        return (lp.priceETH, lp.priceUSDC, lp.active);
    }
    
    /**
     * @notice Get level bonus configuration
     */
    function getLevelBonusConfig(uint8 level) external view returns (uint256 bonusETH, uint256 bonusUSDC, bool active) {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        LevelBonus storage lb = levelBonuses[level];
        return (lb.bonusETH, lb.bonusUSDC, lb.active);
    }
    
    /**
     * @notice Get supply price tier configuration
     */
    function getSupplyPriceTier(uint8 tierIndex) external view returns (
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool enabled
    ) {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        SupplyTier storage tier = supplyPriceTiers[tierIndex];
        return (tier.minSupply, tier.maxSupply, tier.priceETH, tier.priceUSDC, tier.enabled);
    }
    
    /**
     * @notice Get supply bonus tier configuration
     */
    function getSupplyBonusTier(uint8 tierIndex) external view returns (
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool enabled
    ) {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        SupplyBonusTier storage tier = supplyBonusTiers[tierIndex];
        return (tier.minSupply, tier.maxSupply, tier.bonusETH, tier.bonusUSDC, tier.enabled);
    }

*/
