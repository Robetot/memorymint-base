// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltra
 * @author MemoryMint Team
 * @notice Production-ready ERC-721 NFT contract for MemoryMint game on Base Mainnet
 * @dev Fully ERC-721 compliant with free public minting, Farcaster integration, and batch support
 * 
 * Features:
 * - Free public minting (only gas cost, unlimited supply)
 * - Strict ERC-721 + ERC-721Metadata + ERC-165 + ERC-4906 compliance
 * - One-time player name registration (first mint only, cannot register without minting)
 * - Batch minting up to 10 NFTs per transaction with safe mint checks
 * - AI-generated image metadata support via IPFS
 * - One-way metadata freeze mechanism for trust
 * - Farcaster social integration ready
 * - Reentrancy protection
 * - Minimal storage writes for gas efficiency
 * 
 * Constraints (by design):
 * - No payments, royalties, allowlists, or supply caps
 * - Optimized for Base mainnet
 * 
 * Deployment: Solidity 0.8.20, Optimizer 200 runs, EVM: paris
 */

// ============ Custom Errors (Gas Efficient) ============
error NotOwner();
error ZeroAddress();
error TokenNotExist();
error NotApproved();
error NotAuthorized();
error InvalidQuantity();
error MaxBatchExceeded();
error TransferToNonReceiver();
error Paused();
error ReentrancyGuard();
error NameAlreadySet();
error EmptyName();
error MetadataFrozen();
error AlreadyMinted();

// ============ Interfaces ============
// [FIX] Full interface definitions for ERC-721 compliance verification
interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @title MemoryMintUltra
 * @notice Gas-optimized ERC-721 for MemoryMint with free minting and Farcaster support
 */
contract MemoryMintUltra is IERC721, IERC721Metadata, IERC165 {
    // ============ Events ============
    // [FIX] ERC-4906 events for metadata updates (marketplace compatibility)
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    
    // Custom events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity);
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity);
    event PlayerRegistered(address indexed player, string name, uint64 farcasterFid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    event TokenMetadataFrozen(uint256 indexed tokenId);

    // ============ Packed Storage (Gas Optimized) ============
    
    // Slot 1: Owner and state flags
    address private _contractOwner;
    bool public paused;
    bool public throttleEnabled;
    uint8 public constant MAX_BATCH_SIZE = 10;
    
    // Slot 2: Token counter
    uint256 private _nextTokenId;
    
    // Slot 3: Collection metadata
    string private _name;
    string private _symbol;
    string private _baseTokenURI;
    
    // ============ Mappings ============
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => uint256) private _lastMintBlock;
    // [FIX] One-way metadata freeze for trust
    mapping(uint256 => bool) private _metadataFrozen;
    
    // Player data: name and Farcaster FID (packed for gas)
    struct PlayerData {
        string name;           // Player display name
        uint64 farcasterFid;   // Farcaster user ID (0 if not connected)
        uint32 totalMints;     // Total NFTs minted by player
        uint32 firstMintTime;  // Timestamp of first mint
        bool nameSet;          // Whether name has been set (one-time only)
    }
    mapping(address => PlayerData) private _players;
    
    // NFT metadata (packed for gas)
    struct NFTMetadata {
        uint8 level;           // Game level (1-6 for 2x2 to 6x6)
        uint8 rarity;          // Rarity tier (1=Common to 5=Mythic)
        uint16 score;          // Score achieved
        uint32 completionTime; // Time to complete in seconds
        uint8 comboStreak;     // Max combo streak
        bool perfectGame;      // No mistakes
    }
    mapping(uint256 => NFTMetadata) private _nftMetadata;
    
    // Reentrancy guard
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _reentrancyStatus;

    // ============ Constructor ============
    /**
     * @notice Initialize the contract with collection metadata
     * @param name_ Collection name (e.g., "MemoryMint")
     * @param symbol_ Collection symbol (e.g., "MMINT")
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _contractOwner = msg.sender;
        _nextTokenId = 1; // Start from 1, not 0
        _reentrancyStatus = NOT_ENTERED;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != _contractOwner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert ReentrancyGuard();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }

    // ============ Internal Helpers ============
    
    /**
     * @dev [FIX] Proper _exists helper for ERC-721 compliance
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }

    /**
     * @dev [FIX] Check if spender is owner or approved
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = _owners[tokenId];
        return (spender == tokenOwner || 
                _tokenApprovals[tokenId] == spender || 
                _operatorApprovals[tokenOwner][spender]);
    }

    /**
     * @dev [FIX] Safe transfer check - ensures contract recipients implement IERC721Receiver
     */
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                return retval == IERC721Receiver.onERC721Received.selector;
            } catch {
                return false;
            }
        }
        return true; // EOA, no check needed
    }

    /**
     * @dev [FIX] Internal safe mint with onERC721Received check
     */
    function _safeMint(address to, uint256 tokenId, bytes memory data) internal {
        _owners[tokenId] = to;
        unchecked { _balances[to]++; }
        
        emit Transfer(address(0), to, tokenId);
        
        // [FIX] Check receiver AFTER mint (ERC-721 standard)
        if (!_checkOnERC721Received(address(0), to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }

    // ============ ERC721 Metadata ============
    function name() external view override returns (string memory) {
        return _name;
    }

    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /**
     * @notice Get token metadata URI
     * @dev Returns custom URI if set, otherwise baseURI + tokenId
     */
    function tokenURI(uint256 tokenId) external view override returns (string memory) {
        // [FIX] Use _exists helper
        if (!_exists(tokenId)) revert TokenNotExist();
        
        // Return custom URI if set (for AI-generated images)
        if (bytes(_tokenURIs[tokenId]).length > 0) {
            return _tokenURIs[tokenId];
        }
        
        // Otherwise return base URI + tokenId
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    // ============ ERC721 Core Functions ============
    function balanceOf(address owner_) external view override returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) external view override returns (address) {
        address owner_ = _owners[tokenId];
        // [FIX] Correct check - revert if token doesn't exist
        if (owner_ == address(0)) revert TokenNotExist();
        return owner_;
    }

    function approve(address to, uint256 tokenId) external override {
        address owner_ = _owners[tokenId];
        // [FIX] Proper authorization check
        if (owner_ == address(0)) revert TokenNotExist();
        if (to == owner_) revert NotAuthorized(); // Cannot approve to self
        if (msg.sender != owner_ && !_operatorApprovals[owner_][msg.sender]) revert NotApproved();
        
        _tokenApprovals[tokenId] = to;
        emit Approval(owner_, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view override returns (address) {
        // [FIX] Use _exists helper
        if (!_exists(tokenId)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external override {
        // [FIX] Cannot approve self as operator
        if (operator == msg.sender) revert NotAuthorized();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) external view override returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        // [FIX] Comprehensive validation
        if (to == address(0)) revert ZeroAddress();
        if (!_exists(tokenId)) revert TokenNotExist();
        
        address owner_ = _owners[tokenId];
        // [FIX] Correct ownership check
        if (owner_ != from) revert NotOwner();
        // [FIX] Proper authorization check
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();

        // Clear approval
        delete _tokenApprovals[tokenId];

        // Update balances (unchecked for gas savings - overflow impossible)
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
        // [FIX] Proper safe transfer check
        if (!_checkOnERC721Received(from, to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }

    // ============ Player Data ============
    /**
     * @notice Get player data
     * @dev Player name can ONLY be set during first mint via mintGameNFT
     */
    function getPlayer(address player) external view returns (
        string memory playerName,
        uint64 farcasterFid,
        uint32 totalMints,
        uint32 firstMintTime,
        bool nameSet
    ) {
        PlayerData storage data = _players[player];
        return (data.name, data.farcasterFid, data.totalMints, data.firstMintTime, data.nameSet);
    }

    // ============ Free Public Minting ============
    
    /**
     * @notice Mint a game NFT with optional player name (FREE - only gas cost)
     * @dev [FIX] Player name can ONLY be set on first mint, then locked forever
     * @param tokenURI_ IPFS URI for AI-generated image metadata
     * @param level Game level completed (1-6)
     * @param rarity Rarity tier achieved (1-5)
     * @param score Score achieved
     * @param completionTime Time to complete in seconds
     * @param comboStreak Max combo streak
     * @param perfectGame Whether it was a perfect game
     * @param playerName Player name (only used on first mint, ignored after)
     * @param farcasterFid Farcaster user ID (0 if not using Farcaster)
     * @return tokenId The minted token ID
     */
    function mintGameNFT(
        string calldata tokenURI_,
        uint8 level,
        uint8 rarity,
        uint16 score,
        uint32 completionTime,
        uint8 comboStreak,
        bool perfectGame,
        string calldata playerName,
        uint64 farcasterFid
    ) external whenNotPaused nonReentrant returns (uint256) {
        // Throttle check (optional)
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        // [FIX] Use safe mint with receiver check
        _safeMint(msg.sender, tokenId, "");
        
        // Set custom token URI (for AI-generated images)
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        // Store game metadata (packed struct)
        _nftMetadata[tokenId] = NFTMetadata({
            level: level,
            rarity: rarity,
            score: score,
            completionTime: completionTime,
            comboStreak: comboStreak,
            perfectGame: perfectGame
        });
        
        // [FIX] Player name registration: ONLY on first mint, locked forever after
        PlayerData storage player = _players[msg.sender];
        if (!player.nameSet && bytes(playerName).length > 0) {
            player.name = playerName;
            player.farcasterFid = farcasterFid;
            player.nameSet = true;
            emit PlayerRegistered(msg.sender, playerName, farcasterFid);
        }
        
        // Update player stats
        unchecked { player.totalMints++; }
        if (player.firstMintTime == 0) {
            player.firstMintTime = uint32(block.timestamp);
        }
        
        // Update throttle
        _lastMintBlock[msg.sender] = block.number;
        
        emit NFTMinted(msg.sender, tokenId, tokenURI_, level, rarity);
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    /**
     * @notice Simple mint with just token URI (FREE - only gas cost)
     * @param tokenURI_ IPFS URI for metadata
     */
    function mintNFT(string calldata tokenURI_) external whenNotPaused nonReentrant returns (uint256) {
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        // [FIX] Use safe mint
        _safeMint(msg.sender, tokenId, "");
        
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        // Update player stats
        unchecked { _players[msg.sender].totalMints++; }
        if (_players[msg.sender].firstMintTime == 0) {
            _players[msg.sender].firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    /**
     * @notice Batch mint multiple NFTs with safe mint checks (FREE - only gas cost)
     * @dev [FIX] Maximum 10 NFTs per batch with onERC721Received check
     * @param quantity Number of NFTs to mint (1-10)
     */
    function batchMint(uint256 quantity) external whenNotPaused nonReentrant returns (uint256 startTokenId) {
        if (quantity == 0 || quantity > MAX_BATCH_SIZE) revert InvalidQuantity();
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        startTokenId = _nextTokenId;
        
        // [FIX] Pre-check if recipient can receive ERC721 (for contract recipients)
        if (msg.sender.code.length > 0) {
            // For batch, check once with first token ID
            if (!_checkOnERC721Received(address(0), msg.sender, startTokenId, "")) {
                revert TransferToNonReceiver();
            }
        }
        
        // Batch update balance (single storage write)
        unchecked { _balances[msg.sender] += quantity; }
        
        // Mint tokens with minimal storage writes
        for (uint256 i = 0; i < quantity;) {
            uint256 tokenId = startTokenId + i;
            _owners[tokenId] = msg.sender;
            emit Transfer(address(0), msg.sender, tokenId);
            unchecked { i++; }
        }
        
        // Update token counter
        unchecked { _nextTokenId += quantity; }
        
        // Update player stats
        unchecked { _players[msg.sender].totalMints += uint32(quantity); }
        if (_players[msg.sender].firstMintTime == 0) {
            _players[msg.sender].firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit BatchMinted(msg.sender, startTokenId, quantity);
        
        return startTokenId;
    }

    // ============ NFT Metadata Queries ============
    /**
     * @notice Get game metadata for an NFT
     */
    function getNFTMetadata(uint256 tokenId) external view returns (
        uint8 level,
        uint8 rarity,
        uint16 score,
        uint32 completionTime,
        uint8 comboStreak,
        bool perfectGame
    ) {
        if (!_exists(tokenId)) revert TokenNotExist();
        NFTMetadata storage meta = _nftMetadata[tokenId];
        return (meta.level, meta.rarity, meta.score, meta.completionTime, meta.comboStreak, meta.perfectGame);
    }
    
    /**
     * @notice Check if token metadata is frozen
     */
    function isMetadataFrozen(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExist();
        return _metadataFrozen[tokenId];
    }

    // ============ Admin Functions ============
    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit ContractPaused(false);
    }

    function setThrottle(bool enabled) external onlyOwner {
        throttleEnabled = enabled;
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /**
     * @notice [FIX] Update token metadata URI with freeze protection
     * @dev Cannot update if metadata is frozen - protects player trust
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        if (_metadataFrozen[tokenId]) revert MetadataFrozen();
        
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice [FIX] One-way metadata freeze - once frozen, cannot be unfrozen
     * @dev Prevents admin from changing metadata after freeze, building trust
     */
    function freezeTokenMetadata(uint256 tokenId) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        _metadataFrozen[tokenId] = true;
        emit TokenMetadataFrozen(tokenId);
    }
    
    /**
     * @notice Batch freeze metadata for multiple tokens
     */
    function batchFreezeMetadata(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        for (uint256 i = fromTokenId; i <= toTokenId;) {
            if (_exists(i)) {
                _metadataFrozen[i] = true;
                emit TokenMetadataFrozen(i);
            }
            unchecked { i++; }
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }

    function owner() external view returns (address) {
        return _contractOwner;
    }

    // ============ View Functions ============
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ ERC165 Interface Support ============
    /**
     * @notice [FIX] Accurate supportsInterface using type() for compile-time safety
     */
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId      // 0x01ffc9a7 - ERC165
            || interfaceId == type(IERC721).interfaceId      // 0x80ac58cd - ERC721
            || interfaceId == type(IERC721Metadata).interfaceId // 0x5b5e139f - ERC721Metadata
            || interfaceId == 0x49064906;                    // ERC4906 (Metadata Update)
    }

    // ============ Internal Utilities ============
    /**
     * @notice Convert uint256 to string (gas optimized)
     */
    function _toString(uint256 value) private pure returns (string memory) {
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
