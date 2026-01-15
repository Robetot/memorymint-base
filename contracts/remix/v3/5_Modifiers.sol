// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./1_Interfaces.sol";
import "./3_Events.sol";
import "./4_Storage.sol";

/**
 * @title MemoryMint Ultra V3 - Modifiers & Base Logic
 * @notice Part 5/8 - All modifiers and helper functions
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

abstract contract MemoryMintModifiers is MemoryMintStorage, MemoryMintEvents {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Restricts function to contract owner
     */
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    /**
     * @dev Prevents reentrancy attacks
     */
    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert ReentrancyGuard();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }
    
    /**
     * @dev Ensures minting is not paused
     */
    modifier whenNotPaused() {
        if (mintPaused) revert MintPaused();
        _;
    }
    
    /**
     * @dev Ensures kill switch is not active
     */
    modifier whenNotKilled() {
        if (killSwitch) revert KillSwitchActive();
        _;
    }
    
    /**
     * @dev Ensures claims are not paused
     */
    modifier whenClaimsNotPaused() {
        if (claimsPaused) revert ClaimsPaused();
        _;
    }
    
    /**
     * @dev Validates level is within bounds (1-20)
     */
    modifier validLevel(uint8 level) {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        _;
    }
    
    /**
     * @dev Validates tier is within bounds (0-9)
     */
    modifier validTier(uint8 tierId) {
        if (tierId >= MAX_SUPPLY_TIERS) revert InvalidTier();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Returns the USDC contract address for current chain
     */
    function _getUSDCAddress() internal view returns (address) {
        uint256 chainId = block.chainid;
        if (chainId == BASE_MAINNET) return USDC_BASE_MAINNET;
        if (chainId == BASE_SEPOLIA) return USDC_BASE_SEPOLIA;
        return address(0);
    }
    
    /**
     * @dev Validates token exists
     */
    function _requireMinted(uint256 tokenId) internal view {
        if (_owners[tokenId] == address(0)) revert TokenNotFound();
    }
    
    /**
     * @dev Checks if spender is approved or owner
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = _owners[tokenId];
        return (
            spender == tokenOwner ||
            _tokenApprovals[tokenId] == spender ||
            _operatorApprovals[tokenOwner][spender]
        );
    }
    
    /**
     * @dev Verifies signature for anti-bot protection
     */
    function _verifySignature(
        address minter,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) internal view returns (bool) {
        if (block.timestamp > expiration) revert ExpiredSignature();
        if (expiration < block.timestamp + MIN_SIGNATURE_EXPIRATION) revert SignatureExpirationTooShort();
        if (nonce != _nonces[minter]) revert InvalidNonce();
        
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(minter, nonce, expiration, address(this)))
            )
        );
        
        if (_usedSignatures[messageHash]) revert InvalidSignature();
        
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address recoveredSigner = ecrecover(messageHash, v, r, s);
        
        return recoveredSigner == signatureVerifier && recoveredSigner != address(0);
    }
    
    /**
     * @dev Splits signature into r, s, v components
     */
    function _splitSignature(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        if (sig.length != 65) revert InvalidSignature();
        
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        if (v < 27) v += 27;
    }
    
    /**
     * @dev Anti-bot checks based on current mode
     */
    function _checkAntiBot(address minter) internal view {
        WalletData storage data = walletData[minter];
        
        if (antiBotMode == AntiBotMode.DISABLED) return;
        
        // Check wallet limit
        if (walletMintLimit > 0 && data.mintCount >= walletMintLimit) {
            revert WalletLimitExceeded();
        }
        
        // Check cooldown
        if (antiBotMode == AntiBotMode.COOLDOWN_ONLY || antiBotMode == AntiBotMode.FULL) {
            if (mintCooldown > 0 && block.timestamp < data.lastMintTime + mintCooldown) {
                revert MintCooldownActive();
            }
        }
        
        // Check allowlist
        if (antiBotMode == AntiBotMode.ALLOWLIST_ONLY || antiBotMode == AntiBotMode.FULL) {
            if (!allowlist[minter]) revert Unauthorized();
        }
    }
    
    /**
     * @dev Safe transfer to address that may be a contract
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal returns (bool) {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch {
                return false;
            }
        }
        return true;
    }
}
