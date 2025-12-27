// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./6_Minting.sol";

/**
 * @title MemoryMintUltraSafe_Claim
 * @notice Bonus claim system with level verification
 */
abstract contract MemoryMintUltraSafe_Claim is MemoryMintUltraSafe_Minting {
    
    // ============ CLAIM BONUS SYSTEM ============
    
    /**
     * @notice Claim bonus for completing a game level
     * @param level Bonus level ID
     * @param gameLevel Actual game level completed
     * @param userScore User's score
     * @param levelProof Signed proof of level completion
     */
    function claimBonus(uint256 level, uint256 gameLevel, uint256 userScore, bytes calldata levelProof) 
        external nonReentrant onlyBaseMainnet returns (uint256) 
    {
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) revert InvalidBonusLevel();
        
        uint256 currentPool = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > currentPool) revert InsufficientBonusBalance();
        
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) revert ClaimCapReached();
        
        uint256 remaining = config.claimsRemaining;
        if (currentMode == ClaimMode.FCFS && remaining == 0) revert LevelClaimCapReached(level);
        
        WalletData storage walletData = _walletData[msg.sender];
        if ((currentMode == ClaimMode.ONE_TIME || currentMode == ClaimMode.FCFS) && walletData.claimedLevels[level]) {
            revert AlreadyClaimed();
        }
        
        if (!_checkEligibility(msg.sender, level, gameLevel, userScore, levelProof)) revert NotEligible();
        
        // CEI: Effects before interactions
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked { bonusPoolBalanceETH = currentPool - bonusAmount; }
        } else {
            unchecked { bonusPoolBalanceUSDC = currentPool - bonusAmount; }
        }
        
        unchecked { totalClaimsMade++; }
        walletData.claimedLevels[level] = true;
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked { walletData.totalClaimedETH += bonusAmount; }
        } else {
            unchecked { walletData.totalClaimedUSDC += bonusAmount; }
        }
        
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked { config.claimsRemaining = remaining - 1; }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount, payoutCurrency);
        
        // CEI: Interactions last
        if (payoutCurrency == PaymentCurrency.ETH) {
            (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
            if (!success) revert WithdrawFailed();
        } else {
            _safeUSDCTransfer(msg.sender, bonusAmount);
        }
        
        return bonusAmount;
    }
    
    // ============ ELIGIBILITY CHECK ============
    
    function _checkEligibility(
        address wallet, uint256 level, uint256 gameLevel, uint256 userScore, bytes calldata levelProof
    ) internal view returns (bool) {
        BonusConfig storage config = bonusLevels[level];
        EligibilityRules memory rules = eligibilityRules;
        
        bool levelCheck = true;
        bool scoreCheck = true;
        bool nftCheck = true;
        
        if (rules.checkLevel) {
            if (levelProof.length == 0) return false;
            
            bytes32 levelHash = keccak256(abi.encodePacked(wallet, gameLevel, level, address(this), block.chainid));
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", levelHash));
            
            address recovered = _recoverSigner(ethSignedHash, levelProof);
            if (recovered != signatureSigner || recovered == address(0)) return false;
        }
        
        if (rules.checkScore && config.minScore > 0) {
            scoreCheck = userScore >= config.minScore;
        }
        
        if (rules.checkNFTOwnership && config.requiresNFT) {
            nftCheck = _balances[wallet] > 0;
        }
        
        if (rules.useAndLogic) {
            return levelCheck && scoreCheck && nftCheck;
        } else {
            if (!rules.checkLevel && !rules.checkScore && !rules.checkNFTOwnership) return true;
            return levelCheck || scoreCheck || nftCheck;
        }
    }
    
    // ============ ACTIVE LEVEL HELPERS ============
    
    /**
     * @notice Check if level exists in activeLevelIds
     * @dev v4 FIX #4: Helper for duplicate prevention
     */
    function _isLevelInActiveArray(uint256 level) internal view returns (bool) {
        uint256 length = activeLevelIds.length;
        for (uint256 i = 0; i < length; ) {
            if (activeLevelIds[i] == level) return true;
            unchecked { i++; }
        }
        return false;
    }
    
    /**
     * @notice Remove ALL instances of level from activeLevelIds
     * @dev v4 FIX #4: Removes all duplicates, not just first occurrence
     */
    function _removeAllFromActiveLevels(uint256 level) internal {
        uint256 length = activeLevelIds.length;
        uint256 writeIndex = 0;
        
        for (uint256 readIndex = 0; readIndex < length; ) {
            if (activeLevelIds[readIndex] != level) {
                if (writeIndex != readIndex) {
                    activeLevelIds[writeIndex] = activeLevelIds[readIndex];
                }
                unchecked { writeIndex++; }
            }
            unchecked { readIndex++; }
        }
        
        uint256 toRemove = length - writeIndex;
        for (uint256 i = 0; i < toRemove; ) {
            activeLevelIds.pop();
            unchecked { i++; }
        }
        
        if (toRemove > 0) emit BonusLevelRemoved(level);
    }
}
