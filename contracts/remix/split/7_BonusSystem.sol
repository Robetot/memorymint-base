// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              MEMORYMINT ULTRA V2 - PART 7: BONUS SYSTEM                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 7 of 8
 * This file contains bonus system and pool management.
 */

import "./6_Minting.sol";

/**
 * @title MemoryMintBonusSystem
 * @notice Bonus system and pool management implementation
 */
abstract contract MemoryMintBonusSystem is MemoryMintMinting {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                          BONUS SYSTEM
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Configure a bonus level
     * @param level Bonus level (4, 8, 12, 16, 20)
     * @param enabled Whether bonus is enabled
     * @param currency 0 = ETH, 1 = USDC
     * @param amount Bonus amount (wei for ETH, 6 decimals for USDC)
     */
    function setBonusLevel(uint8 level, bool enabled, uint8 currency, uint256 amount) external onlyOwner {
        if (!_isValidBonusLevel(level)) revert InvalidBonusLevel();
        if (currency > 1) revert InvalidCurrency();
        
        bonusLevels[level] = BonusLevel({
            enabled: enabled,
            currency: currency,
            amount: amount
        });
        
        emit BonusLevelConfigured(level, enabled, currency, amount);
    }
    
    /**
     * @notice Claim bonus for a completed level
     * @param level Bonus level to claim (4, 8, 12, 16, 20)
     */
    function claimBonus(uint8 level) external nonReentrant whenNotKilled {
        if (!_isValidBonusLevel(level)) revert InvalidBonusLevel();
        
        BonusLevel storage bonus = bonusLevels[level];
        if (!bonus.enabled) revert BonusNotEnabled();
        if (bonusClaimed[msg.sender][level]) revert AlreadyClaimed();
        if (bonus.amount == 0) revert InvalidBonusLevel();
        
        // CEI: Mark as claimed BEFORE transfer
        bonusClaimed[msg.sender][level] = true;
        
        if (bonus.currency == CURRENCY_ETH) {
            if (bonusPoolETH < bonus.amount) revert InsufficientBonusPool();
            unchecked { bonusPoolETH -= bonus.amount; }
            
            (bool success, ) = payable(msg.sender).call{value: bonus.amount}("");
            if (!success) revert WithdrawFailed();
        } else {
            if (bonusPoolUSDC < bonus.amount) revert InsufficientBonusPool();
            unchecked { bonusPoolUSDC -= bonus.amount; }
            
            _safeUSDCTransfer(msg.sender, bonus.amount);
        }
        
        emit BonusClaimed(msg.sender, level, bonus.amount, bonus.currency);
    }
    
    /**
     * @notice Get bonus level configuration
     * @param level Bonus level to query
     */
    function getBonusLevel(uint8 level) external view returns (bool enabled, uint8 currency, uint256 amount) {
        BonusLevel storage bonus = bonusLevels[level];
        return (bonus.enabled, bonus.currency, bonus.amount);
    }
    
    /**
     * @notice Check if wallet has claimed bonus for level
     * @param wallet Wallet address
     * @param level Bonus level
     */
    function hasClaimed(address wallet, uint8 level) external view returns (bool) {
        return bonusClaimed[wallet][level];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       BONUS POOL MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Deposit ETH to bonus pool
     * @dev This is the ONLY way to fund the ETH bonus pool
     */
    function depositETH() external payable {
        if (msg.value == 0) revert ZeroAmount();
        unchecked { bonusPoolETH += msg.value; }
        emit ETHDeposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw ETH from bonus pool (owner only)
     * @param amount Amount to withdraw in wei
     */
    function withdrawETH(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bonusPoolETH < amount) revert InsufficientBonusPool();
        
        unchecked { bonusPoolETH -= amount; }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit ETHWithdrawn(_contractOwner, amount);
    }
    
    /**
     * @notice Deposit USDC to bonus pool
     * @dev Requires prior USDC approval
     * @param amount Amount to deposit (6 decimals)
     */
    function depositUSDC(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _processUSDCPayment(msg.sender, amount);
        unchecked { bonusPoolUSDC += amount; }
        emit USDCDeposited(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw USDC from bonus pool (owner only)
     * @param amount Amount to withdraw (6 decimals)
     */
    function withdrawUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bonusPoolUSDC < amount) revert InsufficientBonusPool();
        
        unchecked { bonusPoolUSDC -= amount; }
        
        _safeUSDCTransfer(_contractOwner, amount);
        
        emit USDCWithdrawn(_contractOwner, amount);
    }
    
    /**
     * @notice Withdraw collected mint fees (owner only)
     * @dev Properly calculates available fees excluding bonus pools
     */
    function withdrawMintFees() external onlyOwner nonReentrant {
        // ETH fees = contract balance minus bonus pool
        uint256 contractBalance = address(this).balance;
        uint256 availableETH = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        // USDC fees = balance minus bonus pool
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 availableUSDC = usdcBalance > bonusPoolUSDC ? usdcBalance - bonusPoolUSDC : 0;
        
        if (availableETH > 0) {
            (bool success, ) = payable(_contractOwner).call{value: availableETH}("");
            if (!success) revert WithdrawFailed();
        }
        
        if (availableUSDC > 0) {
            _safeUSDCTransfer(_contractOwner, availableUSDC);
        }
        
        emit MintFeesWithdrawn(_contractOwner, availableETH, availableUSDC);
    }
}
