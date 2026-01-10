// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraV2
 * @author MemoryMint Team
 * @notice Production-ready ERC-721 NFT contract with full admin features for Base Mainnet
 * @dev Upgrade from MemoryMintUltra with all previously unsupported admin features
 * 
 * NEW FEATURES (v2):
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
 * @notice Full-featured ERC-721 for MemoryMint with admin panel support
 */
contract MemoryMintUltraV2 is IERC721, IERC721Metadata, IERC165 {
    // ============ Constants ============
    address public constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint8 public constant USDC_DECIMALS = 6;
    uint8 public constant MAX_BATCH_SIZE = 10;
    
    // Supported bonus levels
    uint8[5] public BONUS_LEVELS = [4, 8, 12, 16, 20];
    
    // Currency enum
    uint8 public constant CURRENCY_ETH = 0;
    uint8 public constant CURRENCY_USDC = 1;

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

    // ============ Storage: Core ERC-721 ============
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
    
    // ============ Storage: V2 Features ============
    
    // Kill switch (overrides everything)
    bool public killSwitch;
    
    // Wallet mint limits (anti-bot hard mode)
    uint256 public walletMintLimit; // 0 = unlimited
    mapping(address => uint256) public walletMintCount;
    
    // Paid minting
    uint256 public mintPriceETH; // 0 = free
    uint256 public mintPriceUSDC; // 0 = free (in USDC smallest unit, 6 decimals)
    uint8 public mintCurrency; // 0 = ETH, 1 = USDC
    
    // Bonus system
    struct BonusLevel {
        bool enabled;
        uint8 currency; // 0 = ETH, 1 = USDC
        uint256 amount;
    }
    mapping(uint8 => BonusLevel) public bonusLevels;
    mapping(address => mapping(uint8 => bool)) public bonusClaimed; // wallet => level => claimed
    
    // Bonus pools
    uint256 public bonusPoolETH;
    uint256 public bonusPoolUSDC;
    
    // ============ Storage: Player Data ============
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

    // ============ Internal Helpers ============
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

    // ============ ERC721 Metadata ============
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

    // ============ ERC721 Core Functions ============
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

    // ============ Player Data ============
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

    // ============ Minting Functions ============
    
    /**
     * @notice Mint a game NFT with optional player name
     * @dev Supports free mint (price=0) or paid mint (ETH/USDC)
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

    // ============ Bonus System ============
    
    /**
     * @notice Configure a bonus level
     * @param level Bonus level (4, 8, 12, 16, 20)
     * @param enabled Whether bonus is enabled
     * @param currency 0 = ETH, 1 = USDC
     * @param amount Bonus amount
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
     * @param level Bonus level to claim
     */
    function claimBonus(uint8 level) external nonReentrant whenNotKilled {
        if (!_isValidBonusLevel(level)) revert InvalidBonusLevel();
        
        BonusLevel storage bonus = bonusLevels[level];
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
    
    /**
     * @notice Get bonus level configuration
     */
    function getBonusLevel(uint8 level) external view returns (bool enabled, uint8 currency, uint256 amount) {
        BonusLevel storage bonus = bonusLevels[level];
        return (bonus.enabled, bonus.currency, bonus.amount);
    }
    
    /**
     * @notice Check if wallet has claimed bonus for level
     */
    function hasClaimed(address wallet, uint8 level) external view returns (bool) {
        return bonusClaimed[wallet][level];
    }

    // ============ Bonus Pool Management ============
    
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
     */
    function depositUSDC(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _processUSDCPayment(msg.sender, amount);
        unchecked { bonusPoolUSDC += amount; }
        emit USDCDeposited(msg.sender, amount);
    }
    
    /**
     * @notice Withdraw USDC from bonus pool (owner only)
     */
    function withdrawUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bonusPoolUSDC < amount) revert InsufficientBonusPool();
        
        unchecked { bonusPoolUSDC -= amount; }
        
        _safeUSDCTransfer(_contractOwner, amount);
        
        emit USDCWithdrawn(_contractOwner, amount);
    }

    // ============ Admin: Wallet Mint Limits ============
    
    /**
     * @notice Set wallet mint limit (0 = unlimited)
     */
    function setWalletMintLimit(uint256 maxMints) external onlyOwner {
        walletMintLimit = maxMints;
        emit WalletMintLimitUpdated(maxMints);
    }

    // ============ Admin: Pricing ============
    
    /**
     * @notice Set mint price in ETH (0 = free)
     */
    function setMintPriceETH(uint256 priceWei) external onlyOwner {
        mintPriceETH = priceWei;
        emit MintPriceETHUpdated(priceWei);
    }
    
    /**
     * @notice Set mint price in USDC (0 = free)
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

    // ============ Admin: Emergency Controls ============
    
    /**
     * @notice Emergency stop - disables ALL minting and bonus claims
     */
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

    // ============ Admin: Metadata ============
    
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

    // ============ View Functions ============
    
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
    
    /**
     * @notice Withdraw any collected mint fees (owner only)
     */
    function withdrawMintFees() external onlyOwner nonReentrant {
        // ETH fees (not in bonus pool)
        uint256 contractBalance = address(this).balance;
        uint256 availableETH = contractBalance > bonusPoolETH ? contractBalance - bonusPoolETH : 0;
        
        if (availableETH > 0) {
            (bool success, ) = payable(_contractOwner).call{value: availableETH}("");
            if (!success) revert WithdrawFailed();
        }
        
        // USDC fees (not in bonus pool)
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 usdcBalance = usdc.balanceOf(address(this));
        uint256 availableUSDC = usdcBalance > bonusPoolUSDC ? usdcBalance - bonusPoolUSDC : 0;
        
        if (availableUSDC > 0) {
            _safeUSDCTransfer(_contractOwner, availableUSDC);
        }
    }

    // ============ ERC165 ============
    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC721).interfaceId
            || interfaceId == type(IERC721Metadata).interfaceId
            || interfaceId == 0x49064906; // ERC4906
    }

    // ============ Utilities ============
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
    
    // Allow receiving ETH for deposits
    receive() external payable {
        if (msg.value > 0) {
            unchecked { bonusPoolETH += msg.value; }
            emit ETHDeposited(msg.sender, msg.value);
        }
    }
}
