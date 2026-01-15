// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./5_Modifiers.sol";

/**
 * @title MemoryMint Ultra V3 - ERC721 Core Implementation
 * @notice Part 6/8 - Full ERC721 + ERC165 + ERC4906 implementation
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

abstract contract MemoryMintERC721 is MemoryMintModifiers {
    
    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-721 METADATA
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Returns the token collection name
     */
    function name() external view returns (string memory) {
        return _name;
    }
    
    /**
     * @notice Returns the token collection symbol
     */
    function symbol() external view returns (string memory) {
        return _symbol;
    }
    
    /**
     * @notice Returns the URI for a given token ID
     * @param tokenId The token ID to query
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        _requireMinted(tokenId);
        
        string memory _tokenURI = _tokenURIs[tokenId];
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }
        
        if (bytes(_baseURI).length > 0) {
            return string(abi.encodePacked(_baseURI, _toString(tokenId)));
        }
        
        return "";
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-721 CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Returns the balance of an address
     * @param owner_ The address to query
     */
    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert InvalidAddress();
        return _balances[owner_];
    }
    
    /**
     * @notice Returns the owner of a token
     * @param tokenId The token ID to query
     */
    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotFound();
        return tokenOwner;
    }
    
    /**
     * @notice Approves an address to transfer a token
     * @param to The address to approve
     * @param tokenId The token ID to approve
     */
    function approve(address to, uint256 tokenId) external {
        address tokenOwner = _owners[tokenId];
        if (to == tokenOwner) revert InvalidAddress();
        if (msg.sender != tokenOwner && !_operatorApprovals[tokenOwner][msg.sender]) {
            revert Unauthorized();
        }
        
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }
    
    /**
     * @notice Returns the approved address for a token
     * @param tokenId The token ID to query
     */
    function getApproved(uint256 tokenId) external view returns (address) {
        _requireMinted(tokenId);
        return _tokenApprovals[tokenId];
    }
    
    /**
     * @notice Sets or revokes operator approval
     * @param operator The operator address
     * @param approved Whether to approve or revoke
     */
    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert InvalidAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    /**
     * @notice Returns if an operator is approved for an owner
     * @param owner_ The owner address
     * @param operator The operator address
     */
    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }
    
    /**
     * @notice Transfers a token from one address to another
     * @param from The current owner
     * @param to The new owner
     * @param tokenId The token ID to transfer
     */
    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert Unauthorized();
        _transfer(from, to, tokenId);
    }
    
    /**
     * @notice Safely transfers a token with data
     * @param from The current owner
     * @param to The new owner
     * @param tokenId The token ID to transfer
     * @param data Additional data to pass
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(from, to, tokenId, data)) {
            revert InvalidAddress();
        }
    }
    
    /**
     * @notice Safely transfers a token
     * @param from The current owner
     * @param to The new owner
     * @param tokenId The token ID to transfer
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ERC-165 INTERFACE SUPPORT
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Returns true if the contract supports an interface
     * @param interfaceId The interface identifier
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == IERC165_ID ||
            interfaceId == IERC721_ID ||
            interfaceId == IERC721_METADATA_ID ||
            interfaceId == ERC4906_ID;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTERNAL TRANSFER LOGIC
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @dev Internal transfer implementation
     */
    function _transfer(address from, address to, uint256 tokenId) internal {
        if (_owners[tokenId] != from) revert Unauthorized();
        if (to == address(0)) revert InvalidAddress();
        
        // Clear approvals
        delete _tokenApprovals[tokenId];
        
        // Update balances
        unchecked {
            _balances[from] -= 1;
            _balances[to] += 1;
        }
        
        _owners[tokenId] = to;
        
        emit Transfer(from, to, tokenId);
    }
    
    /**
     * @dev Converts uint256 to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        
        return string(buffer);
    }
}
