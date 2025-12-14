// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintPro
 * @author MemoryMint Team
 * @notice Production-ready ERC-721 NFT contract for MemoryMint game on Base Mainnet
 * @dev Gas-optimized with free public minting, Farcaster integration, and batch support
 * 
 * Features:
 * - Free public minting (only gas cost)
 * - One-time player name registration (first mint only)
 * - Batch minting up to 10 NFTs per transaction
 * - AI-generated image metadata support via IPFS
 * - Farcaster social integration ready
 * - Reentrancy protection
 * - Minimal storage writes for gas efficiency
 */

// ============ Custom Errors (Gas Efficient) ============
error NotOwner();
error ZeroAddress();
error TokenNotExist();
error NotApproved();
error AlreadyMinted();
error InvalidQuantity();
error MaxBatchExceeded();
error TransferFailed();
error Paused();
error ReentrancyGuard();
error NameAlreadySet();
error EmptyName();

// ============ Interfaces ============
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

/**
 * @title MemoryMintPro
 * @notice Gas-optimized ERC-721 for MemoryMint with free minting and Farcaster support
 */
contract MemoryMintPro {
    // ============ Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity);
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity);
    event PlayerRegistered(address indexed player, string name, uint64 farcasterFid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);

    // ============ Packed Storage (Gas Optimized) ============
    
    // Slot 1: Owner and state flags (32 bytes)
    address private _contractOwner;
    bool public paused;
    bool public throttleEnabled;
    uint8 public constant MAX_BATCH_SIZE = 10;
    
    // Slot 2: Token counter (32 bytes)
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
    
    // Player data: name and Farcaster FID (packed for gas)
    struct PlayerData {
        string name;           // Player display name
        uint64 farcasterFid;   // Farcaster user ID (0 if not connected)
        uint32 totalMints;     // Total NFTs minted by player
        uint32 firstMintTime;  // Timestamp of first mint
        bool nameSet;          // Whether name has been set
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
     * @param baseURI_ Base URI for token metadata
     */
    constructor(string memory name_, string memory symbol_, string memory baseURI_) {
        _name = name_;
        _symbol = symbol_;
        _baseTokenURI = baseURI_;
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

    // ============ ERC721 Metadata ============
    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /**
     * @notice Get token metadata URI
     * @dev Returns custom URI if set, otherwise baseURI + tokenId
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        
        // Return custom URI if set (for AI-generated images)
        if (bytes(_tokenURIs[tokenId]).length > 0) {
            return _tokenURIs[tokenId];
        }
        
        // Otherwise return base URI + tokenId
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    // ============ ERC721 Core Functions ============
    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner_ = _owners[tokenId];
        if (owner_ == address(0)) revert TokenNotExist();
        return owner_;
    }

    function approve(address to, uint256 tokenId) external {
        address owner_ = _owners[tokenId];
        if (msg.sender != owner_ && !_operatorApprovals[owner_][msg.sender]) revert NotApproved();
        _tokenApprovals[tokenId] = to;
        emit Approval(owner_, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert ZeroAddress();
        address owner_ = _owners[tokenId];
        if (owner_ != from) revert NotApproved();
        if (msg.sender != owner_ && 
            msg.sender != _tokenApprovals[tokenId] && 
            !_operatorApprovals[owner_][msg.sender]) revert NotApproved();

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

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) revert TransferFailed();
            } catch {
                revert TransferFailed();
            }
        }
    }

    // ============ Player Registration ============
    /**
     * @notice Register player name (one-time, first mint only)
     * @param playerName Display name for leaderboards
     * @param farcasterFid Farcaster user ID (0 if not using Farcaster)
     */
    function registerPlayer(string calldata playerName, uint64 farcasterFid) external {
        if (_players[msg.sender].nameSet) revert NameAlreadySet();
        if (bytes(playerName).length == 0) revert EmptyName();
        
        _players[msg.sender] = PlayerData({
            name: playerName,
            farcasterFid: farcasterFid,
            totalMints: 0,
            firstMintTime: 0,
            nameSet: true
        });
        
        emit PlayerRegistered(msg.sender, playerName, farcasterFid);
    }

    /**
     * @notice Get player data
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
     * @notice Mint a single NFT with custom metadata (FREE - only gas cost)
     * @param tokenURI_ IPFS URI for AI-generated image metadata
     * @param level Game level completed (1-6)
     * @param rarity Rarity tier achieved (1-5)
     * @param score Score achieved
     * @param completionTime Time to complete in seconds
     * @param comboStreak Max combo streak
     * @param perfectGame Whether it was a perfect game
     * @return tokenId The minted token ID
     */
    function mintGameNFT(
        string calldata tokenURI_,
        uint8 level,
        uint8 rarity,
        uint16 score,
        uint32 completionTime,
        uint8 comboStreak,
        bool perfectGame
    ) external whenNotPaused nonReentrant returns (uint256) {
        // Throttle check (optional)
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        // Single storage write for owner
        _owners[tokenId] = msg.sender;
        
        // Update balance
        unchecked { _balances[msg.sender]++; }
        
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
        
        // Update player stats
        PlayerData storage player = _players[msg.sender];
        unchecked { player.totalMints++; }
        if (player.firstMintTime == 0) {
            player.firstMintTime = uint32(block.timestamp);
        }
        
        // Update throttle
        _lastMintBlock[msg.sender] = block.number;
        
        emit Transfer(address(0), msg.sender, tokenId);
        emit NFTMinted(msg.sender, tokenId, tokenURI_, level, rarity);
        emit MetadataUpdate(tokenId);
        
        // Safe transfer check
        if (msg.sender.code.length > 0) {
            try IERC721Receiver(msg.sender).onERC721Received(msg.sender, address(0), tokenId, "") returns (bytes4 retval) {
                if (retval != IERC721Receiver.onERC721Received.selector) revert TransferFailed();
            } catch {
                revert TransferFailed();
            }
        }
        
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
        
        _owners[tokenId] = msg.sender;
        unchecked { _balances[msg.sender]++; }
        
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        // Update player stats
        unchecked { _players[msg.sender].totalMints++; }
        if (_players[msg.sender].firstMintTime == 0) {
            _players[msg.sender].firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit Transfer(address(0), msg.sender, tokenId);
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    /**
     * @notice Batch mint multiple NFTs (FREE - only gas cost)
     * @dev Maximum 10 NFTs per batch for gas efficiency
     * @param quantity Number of NFTs to mint (1-10)
     */
    function batchMint(uint256 quantity) external whenNotPaused nonReentrant returns (uint256 startTokenId) {
        if (quantity == 0 || quantity > MAX_BATCH_SIZE) revert InvalidQuantity();
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        startTokenId = _nextTokenId;
        
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
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        NFTMetadata storage meta = _nftMetadata[tokenId];
        return (meta.level, meta.rarity, meta.score, meta.completionTime, meta.comboStreak, meta.perfectGame);
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
     * @notice Update token metadata URI (admin only)
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
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
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7  // ERC165
            || interfaceId == 0x80ac58cd  // ERC721
            || interfaceId == 0x5b5e139f  // ERC721Metadata
            || interfaceId == 0x49064906; // ERC4906
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
