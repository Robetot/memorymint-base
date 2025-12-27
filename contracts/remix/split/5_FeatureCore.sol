// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./4_BaseLogic.sol";

/**
 * @title MemoryMintUltraSafe_FeatureCore
 * @notice Core feature logic: anti-bot, signature verification, USDC handling
 */
abstract contract MemoryMintUltraSafe_FeatureCore is MemoryMintUltraSafe_Base {
    
    // ============ ANTI-BOT LOGIC ============
    
    function _performAntiBotChecks(address wallet) internal view {
        if (denylistEnabled && denylist[wallet]) revert AddressDenylisted();
        
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        if (allowlistEnabled) {
            if (allowlist[wallet]) return;
            else revert NotAllowlisted();
        }
        
        WalletData storage walletData = _walletData[wallet];
        
        if (mode == AntiBotMode.STRICT && txOriginCheck && tx.origin != wallet) revert BotDetected();
        
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        uint256 cooldown = mintCooldownBlocks;
        uint256 lastBlock = walletData.lastMintBlock;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSince = block.number - lastBlock;
            if (blocksSince < cooldown) {
                unchecked { revert MintCooldownActive(cooldown - blocksSince); }
            }
        }
    }
    
    function _performAntiBotChecksForSignedMint(address wallet) internal view {
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        if (allowlistEnabled) {
            if (allowlist[wallet]) return;
            else revert NotAllowlisted();
        }
        
        WalletData storage walletData = _walletData[wallet];
        
        if (mode == AntiBotMode.STRICT && txOriginCheck && tx.origin != wallet) revert BotDetected();
        
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        uint256 cooldown = mintCooldownBlocks;
        uint256 lastBlock = walletData.lastMintBlock;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSince = block.number - lastBlock;
            if (blocksSince < cooldown) {
                unchecked { revert MintCooldownActive(cooldown - blocksSince); }
            }
        }
    }
    
    // ============ SIGNATURE VERIFICATION ============
    
    /**
     * @notice Verify mint signature with nonce-based replay protection
     * @dev v4: COMPLETE REWRITE with proper expiration and nonce validation
     * 
     * SECURITY NOTES:
     * - Signatures must include wallet-specific nonce to prevent replay attacks
     * - Expiration must be within acceptable window: [now, now + signatureExpirationSeconds]
     * - Message hash includes chainId and contract address to prevent cross-chain/contract replay
     * - Nonce is incremented AFTER successful verification
     */
    function _verifyMintSignature(
        address wallet,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) internal {
        // 1. Validate nonce matches expected value
        uint256 expectedNonce = _nonces[wallet];
        if (nonce != expectedNonce) {
            revert InvalidNonce(expectedNonce, nonce);
        }
        
        // 2. Check if signature has already expired
        if (block.timestamp > expiration) {
            revert SignatureExpired();
        }
        
        // 3. Validate expiration is within allowed window
        if (signatureExpirationSeconds > 0) {
            if (expiration > block.timestamp + signatureExpirationSeconds) {
                revert SignatureExpirationTooFar();
            }
        }
        
        // 4. Build message hash WITH NONCE (v4 change)
        bytes32 messageHash = keccak256(
            abi.encodePacked(wallet, nonce, address(this), block.chainid, expiration)
        );
        
        // 5. Check if signature already used (belt-and-suspenders with nonce)
        if (_signatureUsedAt[messageHash] > 0) {
            revert InvalidSignature();
        }
        
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        // 6. Recover and verify signer
        address recovered = _recoverSigner(ethSignedHash, signature);
        if (recovered != signatureSigner || recovered == address(0)) {
            revert InvalidSignature();
        }
        
        // 7. Mark signature as used
        _signatureUsedAt[messageHash] = block.timestamp;
        
        // 8. Increment nonce for wallet
        unchecked {
            _nonces[wallet] = expectedNonce + 1;
        }
        emit NonceIncremented(wallet, expectedNonce + 1);
    }
    
    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        if (uint256(s) > MAX_S_VALUE) return address(0);
        if (v < 27) unchecked { v += 27; }
        if (v != 27 && v != 28) return address(0);
        
        return ecrecover(hash, v, r, s);
    }
    
    // ============ USDC HANDLING ============
    
    function _processUSDCPayment(address payer, uint256 amount) internal {
        if (amount == 0) return;
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(payer);
        if (balance < amount) revert InsufficientUSDCBalance(amount, balance);
        
        uint256 allowed = usdc.allowance(payer, address(this));
        if (allowed < amount) revert InsufficientUSDCAllowance(amount, allowed);
        
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, payer, address(this), amount)
        );
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    function _safeUSDCTransfer(address to, uint256 amount) internal {
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
}
