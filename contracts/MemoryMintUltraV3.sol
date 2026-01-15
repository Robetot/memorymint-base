// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraV3
 * @author MemoryMint Team
 * @notice Production-ready ERC-721 NFT contract with dynamic pricing and bonuses
 * @dev Upgrade from MemoryMintUltraV2 with dynamic mint pricing and claim bonuses
 * 
 * V3 NEW FEATURES (ADD-ON - 100% BACKWARD COMPATIBLE):
 * - Dynamic mint pricing by level (1-20)
 * - Dynamic mint pricing by supply thresholds
 * - Dynamic claim bonuses by level (1-20)
 * - Dynamic claim bonuses by supply thresholds
 * - Admin-controlled resolution priority
 * - ETH + USDC support for all dynamic features
 * - Unlimited supply compatible
 * 
 * V2 FEATURES (UNCHANGED):
 * - Wallet mint limits (anti-bot hard mode)
 * - Paid minting (ETH + USDC support)
 * - Level-based bonus system (levels 4, 8, 12, 16, 20)
 * - Bonus pools with deposit/withdraw (ETH + USDC)
 * - Global kill switch (emergency override)
 * 
 * BACKWARD COMPATIBLE:
 * - Existing NFTs remain valid
 * - No token ID resets
 * - No ownership changes
 * - Free mint still supported (price = 0)
 * - All existing functions work exactly as before
 * 
 * Deployment: Solidity 0.8.20, Optimizer 200 runs, EVM: paris
 * Network: Base Mainnet (chainId 8453)
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

// V2 Errors
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

// V3 Errors (ADD-ON)
error DynamicPricingDisabled();
error DynamicBonusDisabled();
error InvalidLevel();               // Level must be 1-20
error InvalidSupplyTier();
error TierLimitExceeded();          // Max 20 supply tiers
error LevelLimitExceeded();         // Max 20 levels
error InvalidResolutionPriority();
error PriceResolutionFailed();
error BonusResolutionFailed();

// ============ V3 Enums (ADD-ON) ============

/**
 * @notice Resolution priority for dynamic pricing/bonuses
 * @dev Admin selects how level-based and supply-based values are resolved
 */
enum ResolutionPriority {
    LEVEL_ONLY,           // Only use level-based values
    SUPPLY_ONLY,          // Only use supply-threshold values
    SUPPLY_OVERRIDES,     // Try supply first, fallback to level
    LEVEL_OVERRIDES       // Try level first, fallback to supply
}

// ============ V3 Structs (ADD-ON) ============

/**
 * @notice Level-based pricing configuration (levels 1-20)
 */
struct LevelPrice {
    uint256 priceETH;     // Price in wei
    uint256 priceUSDC;    // Price in USDC (6 decimals)
    bool active;          // Whether this level is configured
}

/**
 * @notice Supply-threshold pricing tier
 * @dev maxSupply of 0 means infinite (applies forever after minSupply)
 */
struct SupplyTier {
    uint256 minSupply;    // Minimum totalMinted for this tier
    uint256 maxSupply;    // Maximum totalMinted (0 = infinite)
    uint256 priceETH;     // Price in wei
    uint256 priceUSDC;    // Price in USDC (6 decimals)
    bool enabled;         // Whether this tier is active
}

/**
 * @notice Level-based bonus configuration (levels 1-20)
 */
struct LevelBonus {
    uint256 bonusETH;     // Bonus amount in wei
    uint256 bonusUSDC;    // Bonus amount in USDC (6 decimals)
    bool active;          // Whether this level bonus is configured
}

/**
 * @notice Supply-threshold bonus tier
 */
struct SupplyBonusTier {
    uint256 minSupply;    // Minimum totalMinted for this tier
    uint256 maxSupply;    // Maximum totalMinted (0 = infinite)
    uint256 bonusETH;     // Bonus in wei
    uint256 bonusUSDC;    // Bonus in USDC (6 decimals)
    bool enabled;         // Whether this tier is active
}

/**
 * @notice Dynamic pricing system configuration
 */
struct DynamicPricingConfig {
    bool enabled;                          // Master switch for dynamic pricing
    ResolutionPriority resolutionPriority; // How to resolve prices
    uint8 levelCount;                      // Number of configured levels (max 20)
    uint8 supplyTierCount;                 // Number of configured supply tiers (max 20)
}

/**
 * @notice Dynamic bonus system configuration
 */
struct DynamicBonusConfig {
    bool enabled;                          // Master switch for dynamic bonuses
    ResolutionPriority resolutionPriority; // How to resolve bonuses
    uint8 levelCount;                      // Number of configured levels (max 20)
    uint8 supplyTierCount;                 // Number of configured supply tiers (max 20)
}

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
 * @title MemoryMintUltraV3
 * @notice Full-featured ERC-721 for MemoryMint with dynamic pricing and bonuses
 */
contract MemoryMintUltraV3 is IERC721, IERC721Metadata, IERC165 {
    // ============ Constants ============
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint8 public constant USDC_DECIMALS = 6;
    uint8 public constant MAX_BATCH_SIZE = 10;
    
    // Supported bonus levels (V2 - original 5 levels)
    uint8[5] public BONUS_LEVELS = [4, 8, 12, 16, 20];
    
    // Currency enum
    uint8 public constant CURRENCY_ETH = 0;
    uint8 public constant CURRENCY_USDC = 1;
    
    // V3 Constants
    uint8 public constant MAX_LEVELS = 20;
    uint8 public constant MAX_SUPPLY_TIERS = 20;

    // ============ Events ============
    // ERC-4906 events
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    
    // Core events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity);
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity);
    event PlayerRegistered(address indexed player, string name, uint64 farcasterFid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    event TokenMetadataFrozen(uint256 indexed tokenId);
    
    // V2 Events
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
    
    // V3 Events (ADD-ON)
    event DynamicPricingEnabled(bool enabled);
    event DynamicPricingResolutionUpdated(ResolutionPriority priority);
    event LevelPriceConfigured(uint8 indexed level, uint256 priceETH, uint256 priceUSDC, bool active);
    event SupplyPriceTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 priceETH, uint256 priceUSDC, bool enabled);
    event DynamicBonusEnabled(bool enabled);
    event DynamicBonusResolutionUpdated(ResolutionPriority priority);
    event LevelBonusConfigured(uint8 indexed level, uint256 bonusETH, uint256 bonusUSDC, bool active);
    event SupplyBonusTierConfigured(uint8 indexed tierIndex, uint256 minSupply, uint256 maxSupply, uint256 bonusETH, uint256 bonusUSDC, bool enabled);
    event DynamicMintPriceUsed(address indexed minter, uint8 level, uint256 price, uint8 currency);
    event DynamicBonusUsed(address indexed claimer, uint8 level, uint256 bonus, uint8 currency);

    // ============ Storage: Core ERC-721 (UNCHANGED) ============
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
    
    // ============ Storage: V2 Features (UNCHANGED) ============
    
    // Kill switch (overrides everything)
    bool public killSwitch;
    
    // Wallet mint limits (anti-bot hard mode)
    uint256 public walletMintLimit; // 0 = unlimited
    mapping(address => uint256) public walletMintCount;
    
    // Paid minting (static prices - still work when dynamic disabled)
    uint256 public mintPriceETH; // 0 = free
    uint256 public mintPriceUSDC; // 0 = free (in USDC smallest unit, 6 decimals)
    uint8 public mintCurrency; // 0 = ETH, 1 = USDC
    
    // Bonus system (V2 - 5 fixed levels)
    struct BonusLevelV2 {
        bool enabled;
        uint8 currency; // 0 = ETH, 1 = USDC
        uint256 amount;
    }
    mapping(uint8 => BonusLevelV2) public bonusLevels;
    mapping(address => mapping(uint8 => bool)) public bonusClaimed; // wallet => level => claimed
    
    // Bonus pools
    uint256 public bonusPoolETH;
    uint256 public bonusPoolUSDC;
    
    // ============ Storage: Player Data (UNCHANGED) ============
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
    
    // ============ Storage: V3 Dynamic Pricing (ADD-ON) ============
    
    DynamicPricingConfig public dynamicPricing;
    mapping(uint8 => LevelPrice) public levelPrices;        // level (1-20) => price config
    mapping(uint8 => SupplyTier) public supplyPriceTiers;   // tierIndex (0-19) => tier config
    
    DynamicBonusConfig public dynamicBonus;
    mapping(uint8 => LevelBonus) public levelBonuses;       // level (1-20) => bonus config
    mapping(uint8 => SupplyBonusTier) public supplyBonusTiers; // tierIndex (0-19) => tier config

    // ============ Constructor ============
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        _reentrancyStatus = NOT_ENTERED;
        
        // Safe defaults
        paused = false;
        killSwitch = false;
        walletMintLimit = 0; // unlimited
        mintPriceETH = 0; // free
        mintPriceUSDC = 0; // free
        mintCurrency = CURRENCY_ETH;
        
        // V3 defaults - disabled by default for backward compatibility
        dynamicPricing.enabled = false;
        dynamicPricing.resolutionPriority = ResolutionPriority.LEVEL_ONLY;
        dynamicBonus.enabled = false;
        dynamicBonus.resolutionPriority = ResolutionPriority.LEVEL_ONLY;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Modifiers (UNCHANGED) ============
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

    // ============ Internal Helpers (UNCHANGED) ============
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
    
    /**
     * @notice Check mint payment with dynamic pricing support (V3)
     * @param level Game level for dynamic price resolution
     */
    function _checkMintPaymentDynamic(uint8 level) internal {
        (uint256 price, bool isDynamic) = _resolveDynamicMintPrice(level, mintCurrency);
        
        if (isDynamic) {
            // Use dynamic price
            if (mintCurrency == CURRENCY_ETH) {
                if (msg.value < price) revert InsufficientPayment();
            } else {
                if (price > 0) {
                    _processUSDCPayment(msg.sender, price);
                }
            }
            emit DynamicMintPriceUsed(msg.sender, level, price, mintCurrency);
        } else {
            // Fallback to static price
            _checkMintPayment();
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

    // ============ ERC721 Metadata (UNCHANGED) ============
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

    // ============ ERC721 Core Functions (UNCHANGED) ============
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

    // ============ Player Data (UNCHANGED) ============
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

    // ============ Minting Functions (UNCHANGED - V2) ============
    
    /**
     * @notice Mint a game NFT with optional player name
     * @dev Supports free mint (price=0) or paid mint (ETH/USDC)
     *      Uses dynamic pricing if enabled (V3)
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
        _checkMintPaymentDynamic(level); // V3: Uses dynamic pricing if enabled
        
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
     * @notice Simple mint with just token URI (UNCHANGED)
     */
    function mintNFT(string calldata tokenURI_) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256) {
        _checkWalletLimit(msg.sender);
        _checkMintPayment(); // Uses static price (backward compatible)
        
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
     * @notice Simple mint with dynamic pricing support (V3 NEW)
     * @param tokenURI_ Token metadata URI
     * @param level Game level for dynamic price resolution
     */
    function mintNFTWithLevel(string calldata tokenURI_, uint8 level) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256) {
        _checkWalletLimit(msg.sender);
        _checkMintPaymentDynamic(level); // Uses dynamic price if enabled
        
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
     * @notice Batch mint multiple NFTs (UNCHANGED)
     */
    function batchMint(uint256 quantity) external payable whenNotPaused whenNotKilled nonReentrant returns (uint256 startTokenId) {
        if (quantity == 0 || quantity > MAX_BATCH_SIZE) revert InvalidQuantity();
        
        // Check wallet limit for batch
        if (walletMintLimit > 0 && walletMintCount[msg.sender] + quantity > walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        // Check batch payment (uses static price)
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

    // ============ Bonus System (V2 - UNCHANGED) ============
    
    /**
     * @notice Configure a bonus level (V2 - 5 fixed levels)
     */
    function setBonusLevel(uint8 level, bool enabled, uint8 currency, uint256 amount) external onlyOwner {
        if (!_isValidBonusLevel(level)) revert InvalidBonusLevel();
        if (currency > 1) revert InvalidCurrency();
        
        bonusLevels[level] = BonusLevelV2({
            enabled: enabled,
            currency: currency,
            amount: amount
        });
        
        emit BonusLevelConfigured(level, enabled, currency, amount);
    }
    
    /**
     * @notice Claim bonus for a completed level (V2 - uses V3 dynamic if enabled)
     */
    function claimBonus(uint8 level) external nonReentrant whenNotKilled {
        if (!_isValidBonusLevel(level)) revert InvalidBonusLevel();
        
        // Check if dynamic bonus is enabled for this level
        (uint256 dynBonus, bool isDynamic) = _resolveDynamicBonus(level, mintCurrency);
        
        if (isDynamic && dynBonus > 0) {
            // Use dynamic bonus
            if (bonusClaimed[msg.sender][level]) revert AlreadyClaimed();
            
            // Mark as claimed BEFORE transfer (CEI pattern)
            bonusClaimed[msg.sender][level] = true;
            
            if (mintCurrency == CURRENCY_ETH) {
                if (bonusPoolETH < dynBonus) revert InsufficientBonusPool();
                unchecked { bonusPoolETH -= dynBonus; }
                
                (bool success, ) = payable(msg.sender).call{value: dynBonus}("");
                if (!success) revert WithdrawFailed();
            } else {
                if (bonusPoolUSDC < dynBonus) revert InsufficientBonusPool();
                unchecked { bonusPoolUSDC -= dynBonus; }
                
                _safeUSDCTransfer(msg.sender, dynBonus);
            }
            
            emit DynamicBonusUsed(msg.sender, level, dynBonus, mintCurrency);
            emit BonusClaimed(msg.sender, level, dynBonus, mintCurrency);
        } else {
            // Use V2 static bonus
            BonusLevelV2 storage bonus = bonusLevels[level];
            if (!bonus.enabled) revert BonusNotEnabled();
            if (bonusClaimed[msg.sender][level]) revert AlreadyClaimed();
            if (bonus.amount == 0) revert InvalidBonusLevel();
            
            // Mark as claimed BEFORE transfer (CEI pattern)
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
    }
    
    /**
     * @notice Get bonus level configuration (V2)
     */
    function getBonusLevel(uint8 level) external view returns (bool enabled, uint8 currency, uint256 amount) {
        BonusLevelV2 storage bonus = bonusLevels[level];
        return (bonus.enabled, bonus.currency, bonus.amount);
    }
    
    /**
     * @notice Check if wallet has claimed bonus for level
     */
    function hasClaimed(address wallet, uint8 level) external view returns (bool) {
        return bonusClaimed[wallet][level];
    }

    // ============ Bonus Pool Management (UNCHANGED) ============
    
    function depositETH() external payable {
        if (msg.value == 0) revert ZeroAmount();
        unchecked { bonusPoolETH += msg.value; }
        emit ETHDeposited(msg.sender, msg.value);
    }
    
    function withdrawETH(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bonusPoolETH < amount) revert InsufficientBonusPool();
        
        unchecked { bonusPoolETH -= amount; }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit ETHWithdrawn(_contractOwner, amount);
    }
    
    function depositUSDC(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _processUSDCPayment(msg.sender, amount);
        unchecked { bonusPoolUSDC += amount; }
        emit USDCDeposited(msg.sender, amount);
    }
    
    function withdrawUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bonusPoolUSDC < amount) revert InsufficientBonusPool();
        
        unchecked { bonusPoolUSDC -= amount; }
        
        _safeUSDCTransfer(_contractOwner, amount);
        
        emit USDCWithdrawn(_contractOwner, amount);
    }

    // ============ Admin: Wallet Mint Limits (UNCHANGED) ============
    
    function setWalletMintLimit(uint256 maxMints) external onlyOwner {
        walletMintLimit = maxMints;
        emit WalletMintLimitUpdated(maxMints);
    }

    // ============ Admin: Static Pricing (UNCHANGED) ============
    
    function setMintPriceETH(uint256 priceWei) external onlyOwner {
        mintPriceETH = priceWei;
        emit MintPriceETHUpdated(priceWei);
    }
    
    function setMintPriceUSDC(uint256 priceUSDC) external onlyOwner {
        mintPriceUSDC = priceUSDC;
        emit MintPriceUSDCUpdated(priceUSDC);
    }
    
    function setMintCurrency(uint8 currency) external onlyOwner {
        if (currency > 1) revert InvalidCurrency();
        mintCurrency = currency;
        emit MintCurrencyUpdated(currency);
    }

    // ============ Admin: Emergency Controls (UNCHANGED) ============
    
    function emergencyStop(bool status) external onlyOwner {
        killSwitch = status;
        emit EmergencyStopSet(status);
    }
    
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

    // ============ Admin: Metadata (UNCHANGED) ============
    
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _baseTokenURI = baseURI_;
    }

    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        if (_metadataFrozen[tokenId]) revert MetadataFrozen();
        
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
    }
    
    function freezeTokenMetadata(uint256 tokenId) external onlyOwner {
        if (!_exists(tokenId)) revert TokenNotExist();
        _metadataFrozen[tokenId] = true;
        emit TokenMetadataFrozen(tokenId);
    }
    
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

    // ============ View Functions (UNCHANGED) ============
    
    function owner() external view returns (address) {
        return _contractOwner;
    }
    
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
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
    
    function isMetadataFrozen(uint256 tokenId) external view returns (bool) {
        if (!_exists(tokenId)) revert TokenNotExist();
        return _metadataFrozen[tokenId];
    }
    
    function withdrawMintFees() external onlyOwner nonReentrant {
        uint256 contractBalance = address(this).balance;
        uint256 availableETH = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        if (availableETH > 0) {
            (bool success, ) = payable(_contractOwner).call{value: availableETH}("");
            if (!success) revert WithdrawFailed();
        }
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 availableUSDC = usdcBalance > bonusPoolUSDC ? usdcBalance - bonusPoolUSDC : 0;
        
        if (availableUSDC > 0) {
            _safeUSDCTransfer(_contractOwner, availableUSDC);
        }
    }

    // ============ ERC165 (UNCHANGED) ============
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || interfaceId == 0x49064906; // ERC4906
    }

    // ============ Utilities (UNCHANGED) ============
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
    
    receive() external payable {
        if (msg.value > 0) {
            unchecked { bonusPoolETH += msg.value; }
            emit ETHDeposited(msg.sender, msg.value);
        }
    }

    // ============================================================================
    // === V3 DYNAMIC PRICING RESOLUTION (INTERNAL) ==============================
    // ============================================================================

    /**
     * @notice Resolve dynamic mint price based on current configuration
     * @param level Game level (1-20) for level-based pricing
     * @param currency 0 = ETH, 1 = USDC
     * @return price The resolved mint price
     * @return isDynamic Whether dynamic pricing was used
     */
    function _resolveDynamicMintPrice(uint8 level, uint8 currency) internal view returns (uint256 price, bool isDynamic) {
        if (!dynamicPricing.enabled) {
            return (0, false);
        }
        
        ResolutionPriority priority = dynamicPricing.resolutionPriority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelPrice(level, currency);
        } else if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyPrice(currency);
        } else if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            (uint256 supplyPrice, bool supplyFound) = _resolveSupplyPrice(currency);
            if (supplyFound) {
                return (supplyPrice, true);
            }
            return _resolveLevelPrice(level, currency);
        } else {
            (uint256 levelPrice, bool levelFound) = _resolveLevelPrice(level, currency);
            if (levelFound) {
                return (levelPrice, true);
            }
            return _resolveSupplyPrice(currency);
        }
    }
    
    function _resolveLevelPrice(uint8 level, uint8 currency) internal view returns (uint256 price, bool found) {
        if (level == 0 || level > MAX_LEVELS) {
            return (0, false);
        }
        
        LevelPrice storage lp = levelPrices[level];
        if (!lp.active) {
            return (0, false);
        }
        
        if (currency == 0) {
            return (lp.priceETH, true);
        } else {
            return (lp.priceUSDC, true);
        }
    }
    
    function _resolveSupplyPrice(uint8 currency) internal view returns (uint256 price, bool found) {
        uint256 currentSupply = _nextTokenId > 0 ? _nextTokenId - 1 : 0;
        
        for (uint8 i = 0; i < dynamicPricing.supplyTierCount; i++) {
            SupplyTier storage tier = supplyPriceTiers[i];
            if (!tier.enabled) continue;
            
            if (currentSupply >= tier.minSupply) {
                if (tier.maxSupply == 0 || currentSupply < tier.maxSupply) {
                    if (currency == 0) {
                        return (tier.priceETH, true);
                    } else {
                        return (tier.priceUSDC, true);
                    }
                }
            }
        }
        
        return (0, false);
    }

    // ============================================================================
    // === V3 DYNAMIC BONUS RESOLUTION (INTERNAL) ================================
    // ============================================================================

    function _resolveDynamicBonus(uint8 level, uint8 currency) internal view returns (uint256 bonus, bool isDynamic) {
        if (!dynamicBonus.enabled) {
            return (0, false);
        }
        
        ResolutionPriority priority = dynamicBonus.resolutionPriority;
        
        if (priority == ResolutionPriority.LEVEL_ONLY) {
            return _resolveLevelBonus(level, currency);
        } else if (priority == ResolutionPriority.SUPPLY_ONLY) {
            return _resolveSupplyBonus(currency);
        } else if (priority == ResolutionPriority.SUPPLY_OVERRIDES) {
            (uint256 supplyBonus, bool supplyFound) = _resolveSupplyBonus(currency);
            if (supplyFound) {
                return (supplyBonus, true);
            }
            return _resolveLevelBonus(level, currency);
        } else {
            (uint256 levelBonusAmt, bool levelFound) = _resolveLevelBonus(level, currency);
            if (levelFound) {
                return (levelBonusAmt, true);
            }
            return _resolveSupplyBonus(currency);
        }
    }
    
    function _resolveLevelBonus(uint8 level, uint8 currency) internal view returns (uint256 bonus, bool found) {
        if (level == 0 || level > MAX_LEVELS) {
            return (0, false);
        }
        
        LevelBonus storage lb = levelBonuses[level];
        if (!lb.active) {
            return (0, false);
        }
        
        if (currency == 0) {
            return (lb.bonusETH, true);
        } else {
            return (lb.bonusUSDC, true);
        }
    }
    
    function _resolveSupplyBonus(uint8 currency) internal view returns (uint256 bonus, bool found) {
        uint256 currentSupply = _nextTokenId > 0 ? _nextTokenId - 1 : 0;
        
        for (uint8 i = 0; i < dynamicBonus.supplyTierCount; i++) {
            SupplyBonusTier storage tier = supplyBonusTiers[i];
            if (!tier.enabled) continue;
            
            if (currentSupply >= tier.minSupply) {
                if (tier.maxSupply == 0 || currentSupply < tier.maxSupply) {
                    if (currency == 0) {
                        return (tier.bonusETH, true);
                    } else {
                        return (tier.bonusUSDC, true);
                    }
                }
            }
        }
        
        return (0, false);
    }

    // ============================================================================
    // === V3 PUBLIC VIEW FUNCTIONS (PRICE/BONUS RESOLUTION) =====================
    // ============================================================================

    /**
     * @notice Get the current effective mint price
     */
    function getEffectiveMintPrice(uint8 level, uint8 currency) external view returns (uint256 price, bool isDynamic) {
        (price, isDynamic) = _resolveDynamicMintPrice(level, currency);
        
        if (!isDynamic) {
            if (currency == 0) {
                return (mintPriceETH, false);
            } else {
                return (mintPriceUSDC, false);
            }
        }
        
        return (price, true);
    }
    
    /**
     * @notice Get the current effective claim bonus
     */
    function getEffectiveBonus(uint8 level, uint8 currency) external view returns (uint256 bonus, bool isDynamic) {
        return _resolveDynamicBonus(level, currency);
    }

    /**
     * @notice Get all configured level prices
     */
    function getAllLevelPrices() external view returns (
        uint8[] memory levels,
        uint256[] memory pricesETH,
        uint256[] memory pricesUSDC,
        bool[] memory activeFlags
    ) {
        uint8 count = dynamicPricing.levelCount;
        levels = new uint8[](count);
        pricesETH = new uint256[](count);
        pricesUSDC = new uint256[](count);
        activeFlags = new bool[](count);
        
        uint8 idx = 0;
        for (uint8 i = 1; i <= MAX_LEVELS && idx < count; i++) {
            if (levelPrices[i].active) {
                levels[idx] = i;
                pricesETH[idx] = levelPrices[i].priceETH;
                pricesUSDC[idx] = levelPrices[i].priceUSDC;
                activeFlags[idx] = true;
                idx++;
            }
        }
    }

    // ============================================================================
    // === V3 ADMIN: DYNAMIC PRICING CONFIGURATION ===============================
    // ============================================================================

    function setDynamicPricingEnabled(bool enabled) external onlyOwner {
        dynamicPricing.enabled = enabled;
        emit DynamicPricingEnabled(enabled);
    }
    
    function setDynamicPricingResolution(ResolutionPriority priority) external onlyOwner {
        if (uint8(priority) > 3) revert InvalidResolutionPriority();
        dynamicPricing.resolutionPriority = priority;
        emit DynamicPricingResolutionUpdated(priority);
    }
    
    function setLevelPrice(uint8 level, uint256 priceETH, uint256 priceUSDC, bool active) external onlyOwner {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        
        bool wasActive = levelPrices[level].active;
        levelPrices[level] = LevelPrice({
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            active: active
        });
        
        if (active && !wasActive) {
            if (dynamicPricing.levelCount < MAX_LEVELS) {
                unchecked { dynamicPricing.levelCount++; }
            }
        } else if (!active && wasActive && dynamicPricing.levelCount > 0) {
            unchecked { dynamicPricing.levelCount--; }
        }
        
        emit LevelPriceConfigured(level, priceETH, priceUSDC, active);
    }
    
    function batchSetLevelPrices(
        uint8[] calldata levels,
        uint256[] calldata pricesETH,
        uint256[] calldata pricesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != pricesETH.length || len != pricesUSDC.length || len != activeFlags.length) {
            revert InvalidQuantity();
        }
        if (len > MAX_LEVELS) revert LevelLimitExceeded();
        
        for (uint256 i = 0; i < len;) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            
            bool wasActive = levelPrices[level].active;
            levelPrices[level] = LevelPrice({
                priceETH: pricesETH[i],
                priceUSDC: pricesUSDC[i],
                active: activeFlags[i]
            });
            
            if (activeFlags[i] && !wasActive && dynamicPricing.levelCount < MAX_LEVELS) {
                unchecked { dynamicPricing.levelCount++; }
            } else if (!activeFlags[i] && wasActive && dynamicPricing.levelCount > 0) {
                unchecked { dynamicPricing.levelCount--; }
            }
            
            emit LevelPriceConfigured(level, pricesETH[i], pricesUSDC[i], activeFlags[i]);
            unchecked { i++; }
        }
    }
    
    function setSupplyPriceTier(
        uint8 tierIndex,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool enabled
    ) external onlyOwner {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidSupplyTier();
        
        bool wasEnabled = supplyPriceTiers[tierIndex].enabled;
        supplyPriceTiers[tierIndex] = SupplyTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            priceETH: priceETH,
            priceUSDC: priceUSDC,
            enabled: enabled
        });
        
        if (enabled && !wasEnabled && dynamicPricing.supplyTierCount < MAX_SUPPLY_TIERS) {
            if (tierIndex >= dynamicPricing.supplyTierCount) {
                dynamicPricing.supplyTierCount = tierIndex + 1;
            }
        }
        
        emit SupplyPriceTierConfigured(tierIndex, minSupply, maxSupply, priceETH, priceUSDC, enabled);
    }

    // ============================================================================
    // === V3 ADMIN: DYNAMIC BONUS CONFIGURATION =================================
    // ============================================================================

    function setDynamicBonusEnabled(bool enabled) external onlyOwner {
        dynamicBonus.enabled = enabled;
        emit DynamicBonusEnabled(enabled);
    }
    
    function setDynamicBonusResolution(ResolutionPriority priority) external onlyOwner {
        if (uint8(priority) > 3) revert InvalidResolutionPriority();
        dynamicBonus.resolutionPriority = priority;
        emit DynamicBonusResolutionUpdated(priority);
    }
    
    function setLevelBonus(uint8 level, uint256 bonusETH, uint256 bonusUSDC, bool active) external onlyOwner {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        
        bool wasActive = levelBonuses[level].active;
        levelBonuses[level] = LevelBonus({
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            active: active
        });
        
        if (active && !wasActive && dynamicBonus.levelCount < MAX_LEVELS) {
            unchecked { dynamicBonus.levelCount++; }
        } else if (!active && wasActive && dynamicBonus.levelCount > 0) {
            unchecked { dynamicBonus.levelCount--; }
        }
        
        emit LevelBonusConfigured(level, bonusETH, bonusUSDC, active);
    }
    
    function batchSetLevelBonuses(
        uint8[] calldata levels,
        uint256[] calldata bonusesETH,
        uint256[] calldata bonusesUSDC,
        bool[] calldata activeFlags
    ) external onlyOwner {
        uint256 len = levels.length;
        if (len != bonusesETH.length || len != bonusesUSDC.length || len != activeFlags.length) {
            revert InvalidQuantity();
        }
        if (len > MAX_LEVELS) revert LevelLimitExceeded();
        
        for (uint256 i = 0; i < len;) {
            uint8 level = levels[i];
            if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
            
            bool wasActive = levelBonuses[level].active;
            levelBonuses[level] = LevelBonus({
                bonusETH: bonusesETH[i],
                bonusUSDC: bonusesUSDC[i],
                active: activeFlags[i]
            });
            
            if (activeFlags[i] && !wasActive && dynamicBonus.levelCount < MAX_LEVELS) {
                unchecked { dynamicBonus.levelCount++; }
            } else if (!activeFlags[i] && wasActive && dynamicBonus.levelCount > 0) {
                unchecked { dynamicBonus.levelCount--; }
            }
            
            emit LevelBonusConfigured(level, bonusesETH[i], bonusesUSDC[i], activeFlags[i]);
            unchecked { i++; }
        }
    }
    
    function setSupplyBonusTier(
        uint8 tierIndex,
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool enabled
    ) external onlyOwner {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        if (maxSupply != 0 && maxSupply <= minSupply) revert InvalidSupplyTier();
        
        bool wasEnabled = supplyBonusTiers[tierIndex].enabled;
        supplyBonusTiers[tierIndex] = SupplyBonusTier({
            minSupply: minSupply,
            maxSupply: maxSupply,
            bonusETH: bonusETH,
            bonusUSDC: bonusUSDC,
            enabled: enabled
        });
        
        if (enabled && !wasEnabled && dynamicBonus.supplyTierCount < MAX_SUPPLY_TIERS) {
            if (tierIndex >= dynamicBonus.supplyTierCount) {
                dynamicBonus.supplyTierCount = tierIndex + 1;
            }
        }
        
        emit SupplyBonusTierConfigured(tierIndex, minSupply, maxSupply, bonusETH, bonusUSDC, enabled);
    }

    // ============================================================================
    // === V3 VIEW: CONFIGURATION STATUS =========================================
    // ============================================================================

    function getDynamicPricingConfig() external view returns (
        bool enabled,
        ResolutionPriority resolutionPriority,
        uint8 levelCount,
        uint8 supplyTierCount
    ) {
        return (
            dynamicPricing.enabled,
            dynamicPricing.resolutionPriority,
            dynamicPricing.levelCount,
            dynamicPricing.supplyTierCount
        );
    }
    
    function getDynamicBonusConfig() external view returns (
        bool enabled,
        ResolutionPriority resolutionPriority,
        uint8 levelCount,
        uint8 supplyTierCount
    ) {
        return (
            dynamicBonus.enabled,
            dynamicBonus.resolutionPriority,
            dynamicBonus.levelCount,
            dynamicBonus.supplyTierCount
        );
    }
    
    function getLevelPrice(uint8 level) external view returns (uint256 priceETH, uint256 priceUSDC, bool active) {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        LevelPrice storage lp = levelPrices[level];
        return (lp.priceETH, lp.priceUSDC, lp.active);
    }
    
    function getLevelBonusConfig(uint8 level) external view returns (uint256 bonusETH, uint256 bonusUSDC, bool active) {
        if (level == 0 || level > MAX_LEVELS) revert InvalidLevel();
        LevelBonus storage lb = levelBonuses[level];
        return (lb.bonusETH, lb.bonusUSDC, lb.active);
    }
    
    function getSupplyPriceTier(uint8 tierIndex) external view returns (
        uint256 minSupply,
        uint256 maxSupply,
        uint256 priceETH,
        uint256 priceUSDC,
        bool enabled
    ) {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        SupplyTier storage tier = supplyPriceTiers[tierIndex];
        return (tier.minSupply, tier.maxSupply, tier.priceETH, tier.priceUSDC, tier.enabled);
    }
    
    function getSupplyBonusTier(uint8 tierIndex) external view returns (
        uint256 minSupply,
        uint256 maxSupply,
        uint256 bonusETH,
        uint256 bonusUSDC,
        bool enabled
    ) {
        if (tierIndex >= MAX_SUPPLY_TIERS) revert TierLimitExceeded();
        SupplyBonusTier storage tier = supplyBonusTiers[tierIndex];
        return (tier.minSupply, tier.maxSupply, tier.bonusETH, tier.bonusUSDC, tier.enabled);
    }
}
