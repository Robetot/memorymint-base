// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./3_Storage.sol";
import "./1_Interfaces.sol";

/**
 * @title MemoryMintUltraSafe_Base
 * @notice Base logic with modifiers, events, and core ERC-721 functions
 */
abstract contract MemoryMintUltraSafe_Base is MemoryMintUltraSafe_Storage {
    
    // ============ EVENTS ============
    
    // ERC-721 Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // ERC-4906 Metadata Update (for OpenSea compatibility)
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    
    // Admin Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MintPriceUpdated(PaymentCurrency currency, uint256 oldPrice, uint256 newPrice);
    event MintingPausedUpdated(bool paused);
    event EmergencyMintDisabledUpdated(bool disabled);
    event BaseURIUpdated(string newBaseURI);
    
    // Anti-Bot Events
    event WalletMintLimitUpdated(uint256 limit);
    event MintCooldownUpdated(uint256 blocks);
    event AllowlistUpdated(address indexed wallet, bool status);
    event DenylistUpdated(address indexed wallet, bool status);
    event AntiBotModeUpdated(AntiBotMode mode, bool txOriginCheck);
    event FCFSMintCapUpdated(uint256 cap);
    event SignatureSignerUpdated(address indexed signer);
    event SignatureExpirationUpdated(uint256 newExpiration);
    
    // Claim Bonus Events
    event BonusLevelConfigured(uint256 indexed level, uint256 amountETH, uint256 amountUSDC, uint256 claimsRemaining);
    event BonusLevelDeactivated(uint256 indexed level);
    event BonusLevelRemoved(uint256 indexed level);
    event BonusClaimed(address indexed claimer, uint256 indexed level, uint256 amount, PaymentCurrency currency);
    event ClaimModeUpdated(ClaimMode mode);
    event ClaimCapUpdated(uint256 cap);
    event EligibilityRulesUpdated();
    event BonusFundsDeposited(uint256 amount, PaymentCurrency currency);
    event BonusFundsWithdrawn(uint256 amount, PaymentCurrency currency);
    
    // Currency Events
    event CurrencyEnabledUpdated(PaymentCurrency currency, bool enabled);
    event ActiveMintCurrencyUpdated(PaymentCurrency currency);
    event ActiveBonusCurrencyUpdated(PaymentCurrency currency);
    
    // v4: New Events
    event NonceIncremented(address indexed wallet, uint256 newNonce);
    event UnexpectedETHDeposit(address indexed sender, uint256 amount);
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        if (msg.sender != _contractOwner) revert NotContractOwner();
        _;
    }
    
    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert ReentrancyGuard();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }
    
    modifier whenNotPaused() {
        if (mintingPaused) revert MintingPaused();
        if (emergencyMintDisabled) revert EmergencyMintDisabled();
        _;
    }
    
    modifier onlyBaseMainnet() {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) {
            revert WrongChain(BASE_MAINNET_CHAIN_ID, block.chainid);
        }
        _;
    }
    
    // ============ ERC-165 ============
    
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == INTERFACE_ID_ERC165 ||
            interfaceId == INTERFACE_ID_ERC721 ||
            interfaceId == INTERFACE_ID_ERC721_METADATA ||
            interfaceId == INTERFACE_ID_ERC4906;
    }
    
    // ============ ERC-721 METADATA ============
    
    function name() external view returns (string memory) { return _name; }
    function symbol() external view returns (string memory) { return _symbol; }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) return customURI;
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }
    
    // ============ ERC-721 CORE ============
    
    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotExist(tokenId);
        return tokenOwner;
    }
    
    function approve(address to, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (to == tokenOwner) revert SelfApproval();
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender)) revert NotApproved();
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert SelfApproval();
        if (operator == address(0)) revert ZeroAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _safeTransfer(from, to, tokenId, data);
    }
    
    // ============ INTERNAL HELPERS ============
    
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        unchecked { _balances[to]++; }
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
        
        if (_isContract(to) && !_checkOnERC721Received(address(0), to, tokenId, "")) {
            revert TransferToNonReceiver();
        }
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != from) revert NotTokenOwner();
        
        if (_tokenApprovals[tokenId] != address(0)) {
            delete _tokenApprovals[tokenId];
            emit Approval(from, address(0), tokenId);
        }
        
        unchecked {
            _balances[from]--;
            _balances[to]++;
        }
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }
    
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory data) internal {
        _transfer(from, to, tokenId);
        if (_isContract(to) && !_checkOnERC721Received(from, to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || getApproved(tokenId) == spender || isApprovedForAll(tokenOwner, spender);
    }
    
    function _isContract(address account) internal view returns (bool) { 
        return account.code.length > 0; 
    }
    
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) internal returns (bool) {
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            return retval == ERC721_RECEIVER_SELECTOR;
        } catch { return false; }
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { unchecked { digits++; temp /= 10; } }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            unchecked { digits--; buffer[digits] = bytes1(uint8(48 + (value % 10))); value /= 10; }
        }
        return string(buffer);
    }
}
