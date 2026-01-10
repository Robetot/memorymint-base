// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                MEMORYMINT ULTRA V2 - PART 4: MODIFIERS                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 4 of 8
 * This file contains all modifiers and internal helpers.
 */

import "./3_Storage.sol";

/**
 * @title MemoryMintModifiers
 * @notice All modifiers and internal helper functions
 */
abstract contract MemoryMintModifiers is MemoryMintStorage {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                             MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════
    
    modifier onlyOwner() {
        if (msg.sender != _contractOwner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }
    
    modifier whenNotKilled() {
        if (killSwitch) revert KillSwitchActive();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert ReentrancyGuard();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════
    
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = _owners[tokenId];
        return (spender == tokenOwner || 
                _tokenApprovals[tokenId] == spender || 
                _operatorApprovals[tokenOwner][spender]);
    }

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

    function _safeMint(address to, uint256 tokenId, bytes memory data) internal {
        _owners[tokenId] = to;
        unchecked { _balances[to]++; }
        
        emit Transfer(address(0), to, tokenId);
        
        if (!_checkOnERC721Received(address(0), to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }
    
    /// @dev Mint fees stay in contract balance (NOT added to bonus pool)
    function _checkMintPayment() internal {
        if (mintCurrency == CURRENCY_ETH) {
            if (msg.value < mintPriceETH) revert InsufficientPayment();
            // ETH stays in contract as mint fees (NOT added to bonusPoolETH)
        } else {
            if (mintPriceUSDC > 0) {
                _processUSDCPayment(msg.sender, mintPriceUSDC);
                // USDC stays in contract as mint fees (NOT added to bonusPoolUSDC)
            }
        }
    }
    
    function _checkWalletLimit(address wallet) internal view {
        if (walletMintLimit > 0 && walletMintCount[wallet] >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
    }
    
    function _processUSDCPayment(address payer, uint256 amount) internal {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(payer);
        if (balance < amount) revert InsufficientUSDCBalance();
        
        uint256 allowed = usdc.allowance(payer, address(this));
        if (allowed < amount) revert InsufficientUSDCAllowance();
        
        (bool success, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, payer, address(this), amount)
        );
        if (!success || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    function _safeUSDCTransfer(address to, uint256 amount) internal {
        (bool success, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!success || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    function _isValidBonusLevel(uint8 level) internal pure returns (bool) {
        return level == 4 || level == 8 || level == 12 || level == 16 || level == 20;
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            unchecked {
                digits++;
                temp /= 10;
            }
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            unchecked {
                digits--;
                buffer[digits] = bytes1(uint8(48 + value % 10));
                value /= 10;
            }
        }
        
        return string(buffer);
    }
}
