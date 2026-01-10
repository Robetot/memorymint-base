// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               MEMORYMINT ULTRA V2 - PART 5: ERC721 CORE                   ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 5 of 8
 * This file contains ERC-721 core functions and metadata.
 */

import "./4_Modifiers.sol";

/**
 * @title MemoryMintERC721Core
 * @notice ERC-721 core functions implementation
 */
abstract contract MemoryMintERC721Core is MemoryMintModifiers, IERC721, IERC721Metadata, IERC165 {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                         ERC-721 METADATA
    // ═══════════════════════════════════════════════════════════════════════
    
    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) external view override returns (string memory) {
        if (!_exists(tokenId)) revert TokenNotExist();
        
        if (bytes(_tokenURIs[tokenId]).length > 0) {
            return _tokenURIs[tokenId];
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       ERC-721 CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    function balanceOf(address owner_) external view override returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        address owner_ = _owners[tokenId];
        if (owner_ == address(0)) revert TokenNotExist();
        return owner_;
    }

    function approve(address to, uint256 tokenId) external override {
        address owner_ = _owners[tokenId];
        if (owner_ == address(0)) revert TokenNotExist();
        if (to == owner_) revert NotAuthorized();
        if (msg.sender != owner_ && !_operatorApprovals[owner_][msg.sender]) revert NotApproved();
        
        _tokenApprovals[tokenId] = to;
        emit Approval(owner_, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view override returns (address) {
        if (!_exists(tokenId)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external override {
        if (operator == msg.sender) revert NotAuthorized();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) external view override returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        if (to == address(0)) revert ZeroAddress();
        if (!_exists(tokenId)) revert TokenNotExist();
        
        address owner_ = _owners[tokenId];
        if (owner_ != from) revert NotOwner();
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();

        delete _tokenApprovals[tokenId];

        unchecked {
            _balances[from]--;
            _balances[to]++;
        }
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external override {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        transferFrom(from, to, tokenId);
        if (!_checkOnERC721Received(from, to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                            ERC-165
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Check interface support
     * @param interfaceId Interface identifier
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId      // 0x01ffc9a7
            || interfaceId == type(IERC721).interfaceId      // 0x80ac58cd
            || interfaceId == type(IERC721Metadata).interfaceId // 0x5b5e139f
            || interfaceId == 0x49064906;                    // ERC4906
    }
}
