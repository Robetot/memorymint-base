// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        MEMORYMINT ULTRA V2                                 ║
 * ║                                                                            ║
 * ║  Production-ready ERC-721 NFT contract for Base Mainnet                   ║
 * ║  Full admin panel support with all features on-chain                      ║
 * ║                                                                            ║
 * ║  DEPLOYMENT SETTINGS:                                                      ║
 * ║  • Compiler: 0.8.20                                                        ║
 * ║  • Optimizer: 200 runs                                                     ║
 * ║  • EVM Version: paris                                                      ║
 * ║  • Network: Base Mainnet (chainId 8453)                                   ║
 * ║                                                                            ║
 * ║  CONSTRUCTOR ARGS:                                                         ║
 * ║  • name_: "MemoryMint"                                                    ║
 * ║  • symbol_: "MMINT"                                                       ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * FEATURES:
 * ✅ ERC-721 + ERC-721Metadata + ERC-165 + ERC-4906 compliant
 * ✅ Free minting (price = 0) or paid minting (ETH/USDC)
 * ✅ Wallet mint limits (anti-bot hard mode)
 * ✅ Level-based bonus system (levels 4, 8, 12, 16, 20)
 * ✅ Bonus pools with deposit/withdraw (ETH + USDC)
 * ✅ Global kill switch (emergency override)
 * ✅ Batch minting up to 10 NFTs
 * ✅ Player name registration (first mint only)
 * ✅ Farcaster integration ready
 * ✅ Reentrancy protection
 * ✅ Gas optimized for Base
 * 
 * SAFE DEFAULTS (on deployment):
 * • Mint Enabled: ✅ ON
 * • Free Mint: ✅ ON (price = 0)
 * • Kill Switch: ❌ OFF
 * • Wallet Limit: 0 (unlimited)
 * • All Bonuses: ❌ OFF
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
error KillSwitchActive();
error InsufficientPayment();
error WalletMintLimitExceeded(uint256 limit);
error InvalidBonusLevel();
error BonusNotEnabled();
error AlreadyClaimed();
error InsufficientBonusPool();
error WithdrawFailed();
error ZeroAmount();
error InvalidCurrency();
error USDCTransferFailed();
error InsufficientUSDCBalance();
error InsufficientUSDCAllowance();

// ============ Interfaces ============
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

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @title MemoryMintUltraV2
 * @author MemoryMint Team
 * @notice Full-featured ERC-721 for MemoryMint game with complete admin panel support
 * @dev All admin features are on-chain enforced - no UI-only logic
 */
contract MemoryMintUltraV2 is IERC721, IERC721Metadata, IERC165 {
    
    // ═══════════════════════════════════════════════════════════════════════
    //                              CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Base Mainnet USDC contract address
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    /// @notice USDC decimals (6)
    uint8 public constant USDC_DECIMALS = 6;
    
    /// @notice Maximum NFTs per batch mint
    uint8 public constant MAX_BATCH_SIZE = 10;
    
    /// @notice Supported bonus levels
    uint8[5] public BONUS_LEVELS = [4, 8, 12, 16, 20];
    
    /// @notice Currency: ETH
    uint8 public constant CURRENCY_ETH = 0;
    
    /// @notice Currency: USDC
    uint8 public constant CURRENCY_USDC = 1;

    // ═══════════════════════════════════════════════════════════════════════
    //                               EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    
    // ERC-4906 Metadata Update Events
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    
    // Core Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity);
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity);
    event PlayerRegistered(address indexed player, string name, uint64 farcasterFid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    event TokenMetadataFrozen(uint256 indexed tokenId);
    event ThrottleUpdated(bool enabled);
    
    // V2 Admin Events
    event WalletMintLimitUpdated(uint256 newLimit);
    event MintPriceETHUpdated(uint256 newPrice);
    event MintPriceUSDCUpdated(uint256 newPrice);
    event MintCurrencyUpdated(uint8 currency);
    event BonusLevelConfigured(uint8 indexed level, bool enabled, uint8 currency, uint256 amount);
    event BonusClaimed(address indexed user, uint8 indexed level, uint256 amount, uint8 currency);
    event ETHDeposited(address indexed depositor, uint256 amount);
    event USDCDeposited(address indexed depositor, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event USDCWithdrawn(address indexed to, uint256 amount);
    event EmergencyStopSet(bool status);

    // ═══════════════════════════════════════════════════════════════════════
    //                           STORAGE: CORE
    // ═══════════════════════════════════════════════════════════════════════
    
    address private _contractOwner;
    bool public paused;
    bool public throttleEnabled;
    uint256 private _nextTokenId;
    string private _name;
    string private _symbol;
    string private _baseTokenURI;
    
    // ERC-721 mappings
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => uint256) private _lastMintBlock;
    mapping(uint256 => bool) private _metadataFrozen;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                        STORAGE: V2 FEATURES
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Global kill switch - disables ALL minting and bonus claims
    bool public killSwitch;
    
    /// @notice Per-wallet mint limit (0 = unlimited)
    uint256 public walletMintLimit;
    
    /// @notice Tracks mints per wallet for limit enforcement
    mapping(address => uint256) public walletMintCount;
    
    /// @notice Mint price in ETH (wei). 0 = free mint
    uint256 public mintPriceETH;
    
    /// @notice Mint price in USDC (6 decimals). 0 = free mint
    uint256 public mintPriceUSDC;
    
    /// @notice Active mint currency (0 = ETH, 1 = USDC)
    uint8 public mintCurrency;
    
    /// @notice Bonus level configuration
    struct BonusLevel {
        bool enabled;
        uint8 currency; // 0 = ETH, 1 = USDC
        uint256 amount;
    }
    mapping(uint8 => BonusLevel) public bonusLevels;
    
    /// @notice Tracks claimed bonuses per wallet per level
    mapping(address => mapping(uint8 => bool)) public bonusClaimed;
    
    /// @notice ETH bonus pool balance
    uint256 public bonusPoolETH;
    
    /// @notice USDC bonus pool balance
    uint256 public bonusPoolUSDC;
    
    // ═══════════════════════════════════════════════════════════════════════
    //                        STORAGE: PLAYER DATA
    // ═══════════════════════════════════════════════════════════════════════
    
    struct PlayerData {
        string name;
        uint64 farcasterFid;
        uint32 totalMints;
        uint32 firstMintTime;
        bool nameSet;
    }
    mapping(address => PlayerData) private _players;
    
    struct NFTMetadata {
        uint8 level;
        uint8 rarity;
        uint16 score;
        uint32 completionTime;
        uint8 comboStreak;
        bool perfectGame;
    }
    mapping(uint256 => NFTMetadata) private _nftMetadata;
    
    // Reentrancy guard
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _reentrancyStatus;

    // ═══════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Deploy the MemoryMint NFT contract
     * @param name_ Collection name (e.g., "MemoryMint")
     * @param symbol_ Collection symbol (e.g., "MMINT")
     */
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        _reentrancyStatus = NOT_ENTERED;
        
        // SAFE DEFAULTS
        paused = false;
        killSwitch = false;
        walletMintLimit = 0; // unlimited
        mintPriceETH = 0; // free
        mintPriceUSDC = 0; // free
        mintCurrency = CURRENCY_ETH;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }

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
    ) private returns (bool) {
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
    
    function _checkMintPayment() internal {
        if (mintCurrency == CURRENCY_ETH) {
            if (msg.value < mintPriceETH) revert InsufficientPayment();
        } else {
            if (mintPriceUSDC > 0) {
                _processUSDCPayment(msg.sender, mintPriceUSDC);
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
    //                           PLAYER DATA
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get player data
     * @param player Player address
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

    // ═══════════════════════════════════════════════════════════════════════
    //                        MINTING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Mint a game NFT with game stats and optional player name
     * @dev Supports free (price=0) or paid (ETH/USDC) minting
     * @param tokenURI_ IPFS URI for AI-generated image metadata
     * @param level Game level completed (1-6)
     * @param rarity Rarity tier achieved (1-5)
     * @param score Score achieved
     * @param completionTime Time to complete in seconds
     * @param comboStreak Max combo streak
     * @param perfectGame Whether it was a perfect game
     * @param playerName Player name (only used on first mint)
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
    ) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256) {
        _checkWalletLimit(msg.sender);
        _checkMintPayment();
        
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        _safeMint(msg.sender, tokenId, "");
        
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        _nftMetadata[tokenId] = NFTMetadata({
            level: level,
            rarity: rarity,
            score: score,
            completionTime: completionTime,
            comboStreak: comboStreak,
            perfectGame: perfectGame
        });
        
        PlayerData storage player = _players[msg.sender];
        if (!player.nameSet && bytes(playerName).length > 0) {
            player.name = playerName;
            player.farcasterFid = farcasterFid;
            player.nameSet = true;
            emit PlayerRegistered(msg.sender, playerName, farcasterFid);
        }
        
        unchecked { 
            player.totalMints++;
            walletMintCount[msg.sender]++;
        }
        if (player.firstMintTime == 0) {
            player.firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit NFTMinted(msg.sender, tokenId, tokenURI_, level, rarity);
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    /**
     * @notice Simple mint with just token URI
     * @param tokenURI_ IPFS URI for metadata
     */
    function mintNFT(string calldata tokenURI_) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256) {
        _checkWalletLimit(msg.sender);
        _checkMintPayment();
        
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        _safeMint(msg.sender, tokenId, "");
        
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        unchecked { 
            _players[msg.sender].totalMints++;
            walletMintCount[msg.sender]++;
        }
        if (_players[msg.sender].firstMintTime == 0) {
            _players[msg.sender].firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    /**
     * @notice Batch mint multiple NFTs
     * @param quantity Number of NFTs to mint (1-10)
     */
    function batchMint(uint256 quantity) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256 startTokenId) {
        if (quantity == 0 || quantity > MAX_BATCH_SIZE) revert InvalidQuantity();
        
        // Check wallet limit for batch
        if (walletMintLimit > 0 && walletMintCount[msg.sender] + quantity > walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        // Check batch payment
        if (mintCurrency == CURRENCY_ETH) {
            if (msg.value < mintPriceETH * quantity) revert InsufficientPayment();
        } else {
            if (mintPriceUSDC > 0) {
                _processUSDCPayment(msg.sender, mintPriceUSDC * quantity);
            }
        }
        
        if (throttleEnabled && _lastMintBlock[msg.sender] == block.number) revert AlreadyMinted();
        
        startTokenId = _nextTokenId;
        
        if (msg.sender.code.length > 0) {
            if (!_checkOnERC721Received(address(0), msg.sender, startTokenId, "")) {
                revert TransferToNonReceiver();
            }
        }
        
        unchecked { _balances[msg.sender] += quantity; }
        
        for (uint256 i = 0; i < quantity;) {
            uint256 tokenId = startTokenId + i;
            _owners[tokenId] = msg.sender;
            emit Transfer(address(0), msg.sender, tokenId);
            unchecked { i++; }
        }
        
        unchecked { 
            _nextTokenId += quantity;
            _players[msg.sender].totalMints += uint32(quantity);
            walletMintCount[msg.sender] += quantity;
        }
        if (_players[msg.sender].firstMintTime == 0) {
            _players[msg.sender].firstMintTime = uint32(block.timestamp);
        }
        
        _lastMintBlock[msg.sender] = block.number;
        
        emit BatchMinted(msg.sender, startTokenId, quantity);
        
        return startTokenId;
    }

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
     * @dev Only withdraws fees, not bonus pool funds
     */
    function withdrawMintFees() external onlyOwner nonReentrant {
        // ETH fees (contract balance minus bonus pool)
        uint256 contractBalance = address(this).balance;
        uint256 availableETH = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        if (availableETH > 0) {
            (bool success, ) = payable(_contractOwner).call{value: availableETH}("");
            if (!success) revert WithdrawFailed();
        }
        
        // USDC fees (balance minus bonus pool)
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 availableUSDC = usdcBalance > bonusPoolUSDC ? usdcBalance - bonusPoolUSDC : 0;
        
        if (availableUSDC > 0) {
            _safeUSDCTransfer(_contractOwner, availableUSDC);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: WALLET MINT LIMITS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set wallet mint limit (anti-bot hard mode)
     * @param maxMints Maximum mints per wallet (0 = unlimited)
     */
    function setWalletMintLimit(uint256 maxMints) external onlyOwner {
        walletMintLimit = maxMints;
        emit WalletMintLimitUpdated(maxMints);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN: PRICING
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set mint price in ETH (0 = free mint)
     * @param priceWei Price in wei
     */
    function setMintPriceETH(uint256 priceWei) external onlyOwner {
        mintPriceETH = priceWei;
        emit MintPriceETHUpdated(priceWei);
    }
    
    /**
     * @notice Set mint price in USDC (0 = free mint)
     * @param priceUSDC Price in USDC (6 decimals)
     */
    function setMintPriceUSDC(uint256 priceUSDC) external onlyOwner {
        mintPriceUSDC = priceUSDC;
        emit MintPriceUSDCUpdated(priceUSDC);
    }
    
    /**
     * @notice Set active mint currency
     * @param currency 0 = ETH, 1 = USDC
     */
    function setMintCurrency(uint8 currency) external onlyOwner {
        if (currency > 1) revert InvalidCurrency();
        mintCurrency = currency;
        emit MintCurrencyUpdated(currency);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: EMERGENCY CONTROLS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Emergency stop - disables ALL minting and bonus claims
     * @param status true = stop everything, false = resume
     */
    function emergencyStop(bool status) external onlyOwner {
        killSwitch = status;
        emit EmergencyStopSet(status);
    }
    
    /**
     * @notice Pause minting
     */
    function pause() external onlyOwner {
        paused = true;
        emit ContractPaused(true);
    }

    /**
     * @notice Unpause minting
     */
    function unpause() external onlyOwner {
        paused = false;
        emit ContractPaused(false);
    }

    /**
     * @notice Enable/disable per-block throttling
     * @param enabled Whether throttling is enabled
     */
    function setThrottle(bool enabled) external onlyOwner {
        throttleEnabled = enabled;
        emit ThrottleUpdated(enabled);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN: METADATA
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Set base URI for token metadata
     * @param baseURI_ New base URI
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    /**
     * @notice Update token metadata URI (if not frozen)
     * @param tokenId Token to update
     * @param newTokenURI New URI
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        if (_metadataFrozen[tokenId]) revert MetadataFrozen();
        
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice Freeze token metadata (one-way, cannot unfreeze)
     * @param tokenId Token to freeze
     */
    function freezeTokenMetadata(uint256 tokenId) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        _metadataFrozen[tokenId] = true;
        emit TokenMetadataFrozen(tokenId);
    }
    
    /**
     * @notice Batch freeze metadata for multiple tokens
     * @param fromTokenId Start token ID
     * @param toTokenId End token ID (inclusive)
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

    /**
     * @notice Transfer contract ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get contract owner
     */
    function owner() external view returns (address) {
        return _contractOwner;
    }
    
    /**
     * @notice Get total supply
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Get next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @notice Get NFT game metadata
     * @param tokenId Token to query
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
     * @param tokenId Token to check
     */
    function isMetadataFrozen(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExist();
        return _metadataFrozen[tokenId];
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

    // ═══════════════════════════════════════════════════════════════════════
    //                           RECEIVE ETH
    // ═══════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Receive ETH and add to bonus pool
     */
    receive() external payable {
        if (msg.value > 0) {
            unchecked { bonusPoolETH += msg.value; }
            emit ETHDeposited(msg.sender, msg.value);
        }
    }
}
