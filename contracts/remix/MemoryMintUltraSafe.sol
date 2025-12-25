// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraSafe
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with dual-currency support (ETH/USDC)
 * @dev Optimized for Base Mainnet ONLY, OpenSea, Farcaster, BaseApp, and Coinbase Smart Wallet compatibility
 * @author MemoryMint Team
 * 
 * DUAL-CURRENCY UPDATE (v3):
 * 
 * FEATURE #1: ETH and USDC support for mint fees and bonus claims
 *             → Admin can enable/disable each currency independently
 *             → Admin can select active payment currency for minting
 *             → Admin can select payout currency for bonus claims
 * 
 * FEATURE #2: Fully configurable pricing with no hard-coded values
 *             → mintPriceUSDC and mintPriceETH both admin-adjustable
 *             → Zero values allowed (free mints)
 *             → No redeployment required for price changes
 * 
 * FEATURE #3: Secure USDC handling with IERC20 safe transfers
 *             → Requires user approval before USDC usage
 *             → Validates balances and transfers
 *             → Prevents partial or failed payments
 * 
 * FEATURE #4: Base Mainnet only (chain ID 8453)
 *             → Uses Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *             → Hard-locked to Base Mainnet
 * 
 * PREVIOUS PRODUCTION FIXES (v2):
 * 
 * FIX #1: tx.origin disabled by default - only enforced in STRICT mode
 *         → Base App, Coinbase Smart Wallet, and Farcaster Frames now work out of the box
 * 
 * FIX #2: Level verification via signed proof when checkLevel is enabled
 *         → Prevents fake level claims; backend must sign level completion
 * 
 * FIX #3: activeLevelIds auto-cleanup when levels are deactivated
 *         → Array stays clean, no unbounded growth
 * 
 * FIX #4: Signature expiration support
 *         → Signatures expire after configurable time, preventing storage bloat
 * 
 * FIX #5: Production-safe constructor defaults
 *         → txOriginCheck=false, MODERATE mode, signatureRequired=true, sensible limits
 * 
 * PREVIOUS SECURITY FIXES (v1):
 * - CEI Pattern enforced in claimBonus
 * - FCFS claimsRemaining underflow protection
 * - Signature replay with wallet binding
 * - Denylist takes absolute precedence
 * - EIP-2 signature malleability protection
 * - Approval clearing on transfer
 */

// ============ INTERFACES ============

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

// ============ CUSTOM ERRORS (Gas Optimized) ============

error NotContractOwner();
error ZeroAddress();
error TokenNotExist(uint256 tokenId);
error NotTokenOwner();
error NotApproved();
error SelfApproval();
error InvalidOperator();
error TransferToNonReceiver();
error InsufficientPayment(uint256 required, uint256 sent);
error WithdrawFailed();
error MintingPaused();
error EmergencyMintDisabled();
error WalletMintLimitExceeded(uint256 limit);
error MintCooldownActive(uint256 blocksRemaining);
error NotAllowlisted();
error AddressDenylisted();
error InvalidSignature();
error SignatureExpired();
error SignatureMalleability();
error FCFSCapReached(uint256 cap);
error BotDetected();
error ReentrancyGuard();
error ClaimNotActive();
error AlreadyClaimed();
error NotEligible();
error InvalidBonusLevel();
error InsufficientBonusBalance();
error ClaimCapReached();
error LevelClaimCapReached(uint256 level);
error InvalidLevelProof();
error WrongChain(uint256 required, uint256 actual);
error CurrencyNotEnabled();
error USDCTransferFailed();
error InsufficientUSDCBalance(uint256 required, uint256 available);
error InsufficientUSDCAllowance(uint256 required, uint256 available);
error InvalidCurrencySelection();

// ============ MAIN CONTRACT ============

contract MemoryMintUltraSafe {
    
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
    
    // ============ ENUMS ============
    
    enum ClaimMode {
        DISABLED,           // 0: No claims allowed
        FCFS,              // 1: First Come First Served with cap
        UNLIMITED,         // 2: Unlimited claims per wallet
        ONE_TIME,          // 3: One claim per wallet per level
        CUSTOM             // 4: Custom admin-defined rules
    }
    
    enum AntiBotMode {
        DISABLED,          // 0: No anti-bot checks
        SOFT,              // 1: Basic checks only (denylist)
        MODERATE,          // 2: Standard protections (limit + cooldown, NO tx.origin)
        STRICT,            // 3: Maximum protection (includes tx.origin - BLOCKS SMART WALLETS)
        CUSTOM             // 4: Custom configuration
    }
    
    enum PaymentCurrency {
        ETH,               // 0: Native ETH
        USDC               // 1: Base USDC (ERC-20)
    }
    
    // ============ STRUCTS ============
    
    struct BonusConfig {
        uint256 amountETH;        // Bonus amount in ETH (wei)
        uint256 amountUSDC;       // Bonus amount in USDC (6 decimals)
        bool active;              // Is this level active
        uint256 claimsRemaining;  // For FCFS mode (0 = exhausted in FCFS)
        uint256 minScore;         // Minimum score required (0 = no requirement)
        bool requiresNFT;         // Must own an NFT to claim
    }
    
    struct WalletData {
        uint256 mintCount;        // Total mints by this wallet
        uint256 lastMintBlock;    // Block number of last mint
        mapping(uint256 => bool) claimedLevels;  // Levels already claimed
        uint256 totalClaimedETH;  // Total bonus amount claimed in ETH
        uint256 totalClaimedUSDC; // Total bonus amount claimed in USDC
    }
    
    struct EligibilityRules {
        bool checkLevel;          // Check level requirement (requires signed proof)
        bool checkScore;          // Check score requirement
        bool checkNFTOwnership;   // Check NFT ownership
        bool useAndLogic;         // true = AND, false = OR
    }
    
    struct CurrencyConfig {
        bool ethEnabled;          // ETH payments enabled
        bool usdcEnabled;         // USDC payments enabled
        PaymentCurrency activeMintCurrency;   // Current mint payment currency
        PaymentCurrency activeBonusCurrency;  // Current bonus payout currency
    }
    
    // ============ CONSTANTS ============
    
    bytes4 private constant ERC721_RECEIVER_SELECTOR = 0x150b7a02;
    bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    bytes4 private constant INTERFACE_ID_ERC4906 = 0x49064906;
    
    // EIP-2 signature malleability bound
    uint256 private constant MAX_S_VALUE = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    
    // Base Mainnet chain ID
    uint256 private constant BASE_MAINNET_CHAIN_ID = 8453;
    
    // Base USDC contract address (official)
    address private constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    // ============ STORAGE ============
    
    // Core ERC-721
    string private _name;
    string private _symbol;
    string private _baseTokenURI;
    
    // Ownership & Tokens
    address private _contractOwner;
    uint256 private _nextTokenId;
    uint256 private _totalMinted;
    
    // Mappings
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;
    
    // Minting Configuration - Dual Currency
    uint256 public mintPriceETH;          // Mint price in ETH (wei)
    uint256 public mintPriceUSDC;         // Mint price in USDC (6 decimals)
    bool public mintingPaused;
    bool public emergencyMintDisabled;
    
    // Currency Configuration
    CurrencyConfig public currencyConfig;
    
    // Anti-Bot Configuration
    AntiBotMode public antiBotMode;
    uint256 public walletMintLimit;        // 0 = unlimited
    uint256 public mintCooldownBlocks;     // 0 = no cooldown
    bool public allowlistEnabled;
    bool public denylistEnabled;
    bool public signatureRequired;
    uint256 public fcfsMintCap;            // 0 = unlimited
    bool public txOriginCheck;             // FIX #1: Now disabled by default
    
    mapping(address => bool) public allowlist;
    mapping(address => bool) public denylist;
    mapping(address => WalletData) private _walletData;
    address public signatureSigner;
    
    // FIX #4: Signature expiration and used signature tracking
    uint256 public signatureExpirationSeconds;  // 0 = no expiration
    mapping(bytes32 => uint256) private _signatureUsedAt;  // messageHash => timestamp used
    
    // Claim Bonus System - Dual Currency
    ClaimMode public claimMode;
    uint256 public totalClaimCap;          // 0 = unlimited
    uint256 public totalClaimsMade;
    uint256 public bonusPoolBalanceETH;    // ETH bonus pool
    uint256 public bonusPoolBalanceUSDC;   // USDC bonus pool
    EligibilityRules public eligibilityRules;
    
    mapping(uint256 => BonusConfig) public bonusLevels;
    uint256[] public activeLevelIds;
    
    // Reentrancy Guard
    uint256 private _reentrancyStatus;
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    
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
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy with production-safe defaults on Base Mainnet
     * @dev FIX #5: Safe defaults for Base App / Smart Wallet / Farcaster compatibility
     */
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_
    ) {
        _name = name_;
        _symbol = symbol_;
        _baseTokenURI = baseURI_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        _reentrancyStatus = NOT_ENTERED;
        
        // FIX #5: Production-safe defaults
        antiBotMode = AntiBotMode.MODERATE;      // Standard protection
        walletMintLimit = 10;                     // Reasonable default
        mintCooldownBlocks = 2;                   // ~4 seconds on Base (~2s blocks)
        txOriginCheck = false;                    // FIX #1: DISABLED by default for smart wallet compatibility
        denylistEnabled = true;                   // Denylist on for safety
        signatureRequired = true;                 // Require signed mints by default
        
        // FIX #4: Default signature expiration (1 hour)
        signatureExpirationSeconds = 3600;
        
        // Default claim settings
        claimMode = ClaimMode.DISABLED;
        
        // Set owner as default signer
        signatureSigner = msg.sender;
        
        // Dual currency defaults - ETH enabled, USDC disabled by default
        currencyConfig = CurrencyConfig({
            ethEnabled: true,
            usdcEnabled: false,
            activeMintCurrency: PaymentCurrency.ETH,
            activeBonusCurrency: PaymentCurrency.ETH
        });
        
        // Default prices: 0 (free mints - admin can change)
        mintPriceETH = 0;
        mintPriceUSDC = 0;
        
        emit OwnershipTransferred(address(0), msg.sender);
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
    
    function name() external view returns (string memory) {
        return _name;
    }
    
    function symbol() external view returns (string memory) {
        return _symbol;
    }
    
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) {
            return customURI;
        }
        
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
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender)) {
            revert NotApproved();
        }
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
    
    // ============ MINTING - ETH ============
    
    /**
     * @notice Mint with ETH without signature (only works if signatureRequired is false)
     */
    function mintNFT(string calldata metadataURI) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        onlyBaseMainnet
        returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        
        if (msg.value < mintPriceETH) {
            revert InsufficientPayment(mintPriceETH, msg.value);
        }
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with ETH and signature verification (recommended)
     * @dev FIX #4: Signatures now include expiration timestamp
     */
    function mintWithSignature(
        string calldata metadataURI,
        uint256 expiration,
        bytes calldata signature
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        onlyBaseMainnet
        returns (uint256) 
    {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        // Denylist check first
        if (denylistEnabled && denylist[msg.sender]) {
            revert AddressDenylisted();
        }
        
        // Verify signature with expiration
        _verifyMintSignature(msg.sender, expiration, signature);
        
        // Standard anti-bot checks (except denylist, already done)
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPriceETH) {
            revert InsufficientPayment(mintPriceETH, msg.value);
        }
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    // ============ MINTING - USDC ============
    
    /**
     * @notice Mint with USDC without signature (only works if signatureRequired is false)
     * @dev Requires prior USDC approval to this contract
     */
    function mintWithUSDC(string calldata metadataURI) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyBaseMainnet
        returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with USDC and signature verification (recommended)
     * @dev Requires prior USDC approval to this contract
     */
    function mintWithUSDCAndSignature(
        string calldata metadataURI,
        uint256 expiration,
        bytes calldata signature
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        onlyBaseMainnet
        returns (uint256) 
    {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        // Denylist check first
        if (denylistEnabled && denylist[msg.sender]) {
            revert AddressDenylisted();
        }
        
        // Verify signature with expiration
        _verifyMintSignature(msg.sender, expiration, signature);
        
        // Standard anti-bot checks (except denylist, already done)
        _performAntiBotChecksForSignedMint(msg.sender);
        
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Internal mint execution (shared by ETH and USDC mints)
     */
    function _executeMint(address minter, string calldata metadataURI) internal returns (uint256) {
        // FCFS cap check
        uint256 totalMinted = _totalMinted;
        uint256 mintCap = fcfsMintCap;
        if (mintCap > 0 && totalMinted >= mintCap) {
            revert FCFSCapReached(mintCap);
        }
        
        uint256 tokenId = _nextTokenId;
        
        // Update state BEFORE external interaction (CEI pattern)
        unchecked {
            _nextTokenId = tokenId + 1;
            _totalMinted = totalMinted + 1;
        }
        
        // Update wallet data
        WalletData storage walletData = _walletData[minter];
        unchecked {
            walletData.mintCount++;
        }
        walletData.lastMintBlock = block.number;
        
        // Mint
        _mint(minter, tokenId);
        
        // Set custom URI if provided
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
    
    /**
     * @notice Process USDC payment with safety checks
     * @dev HARDENED: Uses low-level call to handle non-standard ERC20 returns (SafeERC20 pattern)
     */
    function _processUSDCPayment(address payer, uint256 amount) internal {
        if (amount == 0) return; // Free mint, no payment needed
        
        IERC20 usdc = IERC20(BASE_USDC);
        
        // Check balance
        uint256 balance = usdc.balanceOf(payer);
        if (balance < amount) {
            revert InsufficientUSDCBalance(amount, balance);
        }
        
        // Check allowance
        uint256 allowed = usdc.allowance(payer, address(this));
        if (allowed < amount) {
            revert InsufficientUSDCAllowance(amount, allowed);
        }
        
        // HARDENED: Safe transferFrom using low-level call to handle non-standard ERC20 returns
        // Base USDC is standard, but this protects against edge cases
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, payer, address(this), amount)
        );
        
        // Check call succeeded and either returned true or returned nothing (non-standard ERC20)
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    /**
     * @notice Safe USDC transfer with non-standard ERC20 handling
     * @dev HARDENED: Uses low-level call pattern for maximum compatibility
     */
    function _safeUSDCTransfer(address to, uint256 amount) internal {
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    // ============ CLAIM BONUS SYSTEM ============
    
    /**
     * @notice Claim bonus for completing a level (pays in admin-selected currency)
     * @dev FIX #2: Requires signed levelProof when eligibilityRules.checkLevel is enabled
     * @param level The bonus level ID to claim
     * @param gameLevel The game level completed (for verification)
     * @param userScore Player's score
     * @param levelProof Signed proof from backend (required if checkLevel is enabled)
     */
    function claimBonus(
        uint256 level, 
        uint256 gameLevel,
        uint256 userScore,
        bytes calldata levelProof
    ) 
        external 
        nonReentrant 
        onlyBaseMainnet
        returns (uint256) 
    {
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        
        // Validate payout currency is enabled
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        // Cache storage reads
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        
        // Get bonus amount based on active payout currency
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) revert InvalidBonusLevel();
        
        // Check pool balance
        uint256 currentPool = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > currentPool) revert InsufficientBonusBalance();
        
        // Check total claim cap
        uint256 claimCap = totalClaimCap;
        if (claimCap > 0 && totalClaimsMade >= claimCap) {
            revert ClaimCapReached();
        }
        
        // Check FCFS remaining
        uint256 remaining = config.claimsRemaining;
        if (currentMode == ClaimMode.FCFS) {
            if (remaining == 0) {
                revert LevelClaimCapReached(level);
            }
        }
        
        WalletData storage walletData = _walletData[msg.sender];
        
        // Check one-time claim per level
        if (currentMode == ClaimMode.ONE_TIME || currentMode == ClaimMode.FCFS) {
            if (walletData.claimedLevels[level]) {
                revert AlreadyClaimed();
            }
        }
        
        // FIX #2: Check eligibility with level proof verification
        if (!_checkEligibility(msg.sender, level, gameLevel, userScore, levelProof)) {
            revert NotEligible();
        }
        
        // ============ CEI PATTERN - ALL STATE UPDATES BEFORE EXTERNAL CALL ============
        
        // Update bonus pool
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked {
                bonusPoolBalanceETH = currentPool - bonusAmount;
            }
        } else {
            unchecked {
                bonusPoolBalanceUSDC = currentPool - bonusAmount;
            }
        }
        
        // Update total claims
        unchecked {
            totalClaimsMade++;
        }
        
        // Mark level as claimed for this wallet
        walletData.claimedLevels[level] = true;
        
        // Update wallet total claimed
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked {
                walletData.totalClaimedETH += bonusAmount;
            }
        } else {
            unchecked {
                walletData.totalClaimedUSDC += bonusAmount;
            }
        }
        
        // Decrement FCFS remaining
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked {
                config.claimsRemaining = remaining - 1;
            }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount, payoutCurrency);
        
        // ============ EXTERNAL CALL LAST ============
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
            if (!success) revert WithdrawFailed();
        } else {
            // HARDENED: Use safe USDC transfer
            _safeUSDCTransfer(msg.sender, bonusAmount);
        }
        
        return bonusAmount;
    }
    
    /**
     * @notice Legacy claimBonus for backwards compatibility
     * @dev Calls new claimBonus with empty level proof
     */
    function claimBonus(uint256 level, uint256 userScore) 
        external 
        nonReentrant 
        onlyBaseMainnet
        returns (uint256) 
    {
        // For backwards compatibility when checkLevel is disabled
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) revert InvalidBonusLevel();
        
        uint256 currentPool = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > currentPool) revert InsufficientBonusBalance();
        
        uint256 claimCap = totalClaimCap;
        if (claimCap > 0 && totalClaimsMade >= claimCap) {
            revert ClaimCapReached();
        }
        
        uint256 remaining = config.claimsRemaining;
        if (currentMode == ClaimMode.FCFS && remaining == 0) {
            revert LevelClaimCapReached(level);
        }
        
        WalletData storage walletData = _walletData[msg.sender];
        
        if (currentMode == ClaimMode.ONE_TIME || currentMode == ClaimMode.FCFS) {
            if (walletData.claimedLevels[level]) {
                revert AlreadyClaimed();
            }
        }
        
        // Empty proof - will fail if checkLevel is enabled
        if (!_checkEligibility(msg.sender, level, level, userScore, "")) {
            revert NotEligible();
        }
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked {
                bonusPoolBalanceETH = currentPool - bonusAmount;
            }
        } else {
            unchecked {
                bonusPoolBalanceUSDC = currentPool - bonusAmount;
            }
        }
        
        unchecked {
            totalClaimsMade++;
        }
        
        walletData.claimedLevels[level] = true;
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked {
                walletData.totalClaimedETH += bonusAmount;
            }
        } else {
            unchecked {
                walletData.totalClaimedUSDC += bonusAmount;
            }
        }
        
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked {
                config.claimsRemaining = remaining - 1;
            }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount, payoutCurrency);
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
            if (!success) revert WithdrawFailed();
        } else {
            // HARDENED: Use safe USDC transfer
            _safeUSDCTransfer(msg.sender, bonusAmount);
        }
        
        return bonusAmount;
    }
    
    /**
     * @notice Check eligibility for bonus claim
     * @dev FIX #2: Enforces level verification via signed proof when checkLevel is enabled
     */
    function _checkEligibility(
        address wallet,
        uint256 level,
        uint256 gameLevel,
        uint256 userScore,
        bytes calldata levelProof
    ) internal view returns (bool) {
        BonusConfig storage config = bonusLevels[level];
        EligibilityRules memory rules = eligibilityRules;
        
        bool levelCheck = true;
        bool scoreCheck = true;
        bool nftCheck = true;
        
        // FIX #2: Level verification via signed proof
        if (rules.checkLevel) {
            // Require valid level proof signed by signatureSigner
            if (levelProof.length == 0) {
                return false;  // No proof provided but required
            }
            
            bytes32 levelHash = keccak256(
                abi.encodePacked(
                    wallet, 
                    gameLevel, 
                    level,          // CRITICAL: Binds proof to specific bonus level
                    address(this), 
                    block.chainid
                )
            );
            bytes32 ethSignedHash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", levelHash)
            );
            
            address recovered = _recoverSigner(ethSignedHash, levelProof);
            if (recovered != signatureSigner || recovered == address(0)) {
                return false;  // Invalid level proof
            }
            
            levelCheck = true;  // Proof verified
        }
        
        if (rules.checkScore && config.minScore > 0) {
            scoreCheck = userScore >= config.minScore;
        }
        
        if (rules.checkNFTOwnership && config.requiresNFT) {
            nftCheck = _balances[wallet] > 0;
        }
        
        if (rules.useAndLogic) {
            return levelCheck && scoreCheck && nftCheck;
        } else {
            // OR logic
            if (!rules.checkLevel && !rules.checkScore && !rules.checkNFTOwnership) {
                return true;  // No requirements set
            }
            return levelCheck || scoreCheck || nftCheck;
        }
    }
    
    // ============ ANTI-BOT INTERNAL ============
    
    /**
     * @notice Core anti-bot validation
     * @dev FIX #1: tx.origin check ONLY enforced in STRICT mode
     */
    function _performAntiBotChecks(address wallet) internal view {
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        // DENYLIST CHECK FIRST - Takes absolute precedence
        if (denylistEnabled && denylist[wallet]) {
            revert AddressDenylisted();
        }
        
        // Allowlist check - if enabled and wallet is allowlisted, skip other checks
        if (allowlistEnabled) {
            if (allowlist[wallet]) {
                return;  // Allowlisted wallet passes
            } else {
                revert NotAllowlisted();
            }
        }
        
        // Cache wallet data
        WalletData storage walletData = _walletData[wallet];
        uint256 mintCount = walletData.mintCount;
        uint256 lastBlock = walletData.lastMintBlock;
        
        // FIX #1: tx.origin check ONLY in STRICT mode
        if (mode == AntiBotMode.STRICT && txOriginCheck) {
            if (tx.origin != wallet) {
                revert BotDetected();
            }
        }
        
        // Wallet mint limit
        uint256 limit = walletMintLimit;
        if (limit > 0 && mintCount >= limit) {
            revert WalletMintLimitExceeded(limit);
        }
        
        // Cooldown check
        uint256 cooldown = mintCooldownBlocks;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSinceLastMint = block.number - lastBlock;
            if (blocksSinceLastMint < cooldown) {
                unchecked {
                    revert MintCooldownActive(cooldown - blocksSinceLastMint);
                }
            }
        }
    }
    
    /**
     * @notice Anti-bot checks for signed mints (denylist already checked)
     */
    function _performAntiBotChecksForSignedMint(address wallet) internal view {
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        // Allowlist check
        if (allowlistEnabled) {
            if (allowlist[wallet]) {
                return;
            } else {
                revert NotAllowlisted();
            }
        }
        
        WalletData storage walletData = _walletData[wallet];
        uint256 mintCount = walletData.mintCount;
        uint256 lastBlock = walletData.lastMintBlock;
        
        // FIX #1: tx.origin check ONLY in STRICT mode
        if (mode == AntiBotMode.STRICT && txOriginCheck) {
            if (tx.origin != wallet) {
                revert BotDetected();
            }
        }
        
        uint256 limit = walletMintLimit;
        if (limit > 0 && mintCount >= limit) {
            revert WalletMintLimitExceeded(limit);
        }
        
        uint256 cooldown = mintCooldownBlocks;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSinceLastMint = block.number - lastBlock;
            if (blocksSinceLastMint < cooldown) {
                unchecked {
                    revert MintCooldownActive(cooldown - blocksSinceLastMint);
                }
            }
        }
    }
    
    /**
     * @notice Verify mint signature with expiration
     * @dev FIX #4: Signatures include expiration timestamp and are tracked for replay prevention
     *      HARDENED: signatureExpirationSeconds now enforced - signatures must have expiration within allowed window
     */
    function _verifyMintSignature(
        address wallet,
        uint256 expiration,
        bytes calldata signature
    ) internal {
        // HARDENED: Enforce signature expiration strictly
        // If expiration is 0 and signatureExpirationSeconds > 0, reject (no perpetual signatures)
        if (signatureExpirationSeconds > 0) {
            if (expiration == 0) {
                revert SignatureExpired(); // Perpetual signatures not allowed when expiration is configured
            }
            // Check signature was created within allowed window
            // expiration must be between now and now + signatureExpirationSeconds
            if (expiration > block.timestamp + signatureExpirationSeconds) {
                revert SignatureExpired(); // Expiration too far in future (reject backdated signatures with long expiry)
            }
        }
        
        // Check if signature has already expired
        if (expiration > 0 && block.timestamp > expiration) {
            revert SignatureExpired();
        }
        
        // Build message hash with wallet binding
        bytes32 messageHash = keccak256(
            abi.encodePacked(wallet, address(this), block.chainid, expiration)
        );
        
        // Check if signature already used
        if (_signatureUsedAt[messageHash] > 0) {
            revert InvalidSignature();
        }
        
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address recovered = _recoverSigner(ethSignedHash, signature);
        if (recovered != signatureSigner || recovered == address(0)) {
            revert InvalidSignature();
        }
        
        // Mark signature as used with timestamp
        _signatureUsedAt[messageHash] = block.timestamp;
    }
    
    /**
     * @notice Recover signer from signature
     * @dev EIP-2 compliant with malleability protection
     */
    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        // EIP-2 malleability protection
        if (uint256(s) > MAX_S_VALUE) {
            return address(0);
        }
        
        if (v < 27) {
            unchecked { v += 27; }
        }
        
        if (v != 27 && v != 28) return address(0);
        
        return ecrecover(hash, v, r, s);
    }
    
    // ============ ADMIN: CURRENCY CONFIGURATION ============
    
    /**
     * @notice Enable or disable ETH payments
     */
    function setETHEnabled(bool enabled) external onlyOwner {
        currencyConfig.ethEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.ETH, enabled);
    }
    
    /**
     * @notice Enable or disable USDC payments
     */
    function setUSDCEnabled(bool enabled) external onlyOwner {
        currencyConfig.usdcEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.USDC, enabled);
    }
    
    /**
     * @notice Set active mint payment currency
     * @dev Currency must be enabled before setting as active
     */
    function setActiveMintCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        currencyConfig.activeMintCurrency = currency;
        emit ActiveMintCurrencyUpdated(currency);
    }
    
    /**
     * @notice Set active bonus payout currency
     * @dev Currency must be enabled before setting as active
     */
    function setActiveBonusCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        currencyConfig.activeBonusCurrency = currency;
        emit ActiveBonusCurrencyUpdated(currency);
    }
    
    // ============ ADMIN: MINTING ============
    
    /**
     * @notice Set mint price in ETH (wei)
     */
    function setMintPriceETH(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceETH;
        mintPriceETH = newPrice;
        emit MintPriceUpdated(PaymentCurrency.ETH, oldPrice, newPrice);
    }
    
    /**
     * @notice Set mint price in USDC (6 decimals)
     */
    function setMintPriceUSDC(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceUSDC;
        mintPriceUSDC = newPrice;
        emit MintPriceUpdated(PaymentCurrency.USDC, oldPrice, newPrice);
    }
    
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
        if (_totalMinted > 0) {
            emit BatchMetadataUpdate(1, _nextTokenId - 1);
        }
    }
    
    function pauseMinting(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPausedUpdated(paused);
    }
    
    function setEmergencyMintDisabled(bool disabled) external onlyOwner {
        emergencyMintDisabled = disabled;
        emit EmergencyMintDisabledUpdated(disabled);
    }
    
    // ============ ADMIN: ANTI-BOT ============
    
    /**
     * @notice Set anti-bot mode
     * @dev FIX #1: tx.origin auto-enabled for STRICT mode, disabled otherwise
     */
    function setAntiBotMode(AntiBotMode mode) external onlyOwner {
        antiBotMode = mode;
        
        // FIX #1: Auto-configure tx.origin based on mode
        if (mode == AntiBotMode.STRICT) {
            txOriginCheck = true;
        } else if (mode == AntiBotMode.MODERATE || mode == AntiBotMode.SOFT) {
            txOriginCheck = false;
        }
        // CUSTOM and DISABLED don't auto-adjust
        
        emit AntiBotModeUpdated(mode, txOriginCheck);
    }
    
    /**
     * @notice Manual tx.origin toggle (for CUSTOM mode only)
     * @dev WARNING: Enabling blocks Base App, Coinbase Smart Wallet, and Farcaster Frames!
     */
    function setTxOriginCheck(bool enabled) external onlyOwner {
        txOriginCheck = enabled;
        emit AntiBotModeUpdated(antiBotMode, enabled);
    }
    
    function setWalletMintLimit(uint256 limit) external onlyOwner {
        walletMintLimit = limit;
        emit WalletMintLimitUpdated(limit);
    }
    
    function setMintCooldown(uint256 blocks) external onlyOwner {
        mintCooldownBlocks = blocks;
        emit MintCooldownUpdated(blocks);
    }
    
    function setFCFSMintCap(uint256 cap) external onlyOwner {
        fcfsMintCap = cap;
        emit FCFSMintCapUpdated(cap);
    }
    
    function setAllowlistEnabled(bool enabled) external onlyOwner {
        allowlistEnabled = enabled;
    }
    
    function setDenylistEnabled(bool enabled) external onlyOwner {
        denylistEnabled = enabled;
    }
    
    function updateAllowlist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            address wallet = wallets[i];
            if (wallet != address(0)) {
                allowlist[wallet] = status;
                emit AllowlistUpdated(wallet, status);
            }
            unchecked { i++; }
        }
    }
    
    function updateDenylist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            address wallet = wallets[i];
            if (wallet != address(0)) {
                denylist[wallet] = status;
                emit DenylistUpdated(wallet, status);
            }
            unchecked { i++; }
        }
    }
    
    function setSignatureRequired(bool required) external onlyOwner {
        signatureRequired = required;
    }
    
    function setSignatureSigner(address signer) external onlyOwner {
        signatureSigner = signer;
        emit SignatureSignerUpdated(signer);
    }
    
    /**
     * @notice Set signature expiration time
     * @dev FIX #4: Configurable expiration (0 = no expiration)
     */
    function setSignatureExpiration(uint256 seconds_) external onlyOwner {
        signatureExpirationSeconds = seconds_;
        emit SignatureExpirationUpdated(seconds_);
    }
    
    // ============ ADMIN: CLAIM BONUS ============
    
    function setClaimMode(ClaimMode mode) external onlyOwner {
        claimMode = mode;
        emit ClaimModeUpdated(mode);
    }
    
    function setTotalClaimCap(uint256 cap) external onlyOwner {
        totalClaimCap = cap;
        emit ClaimCapUpdated(cap);
    }
    
    /**
     * @notice Configure a bonus level with dual-currency amounts
     * @dev FIX #3: Now properly manages activeLevelIds array
     */
    function configureBonusLevel(
        uint256 level,
        uint256 amountETH,
        uint256 amountUSDC,
        bool active,
        uint256 claimsRemaining,
        uint256 minScore,
        bool requiresNFT
    ) external onlyOwner {
        BonusConfig storage config = bonusLevels[level];
        bool wasActive = config.active;
        
        config.amountETH = amountETH;
        config.amountUSDC = amountUSDC;
        config.active = active;
        config.claimsRemaining = claimsRemaining;
        config.minScore = minScore;
        config.requiresNFT = requiresNFT;
        
        // FIX #3: Manage activeLevelIds properly
        if (active && !wasActive) {
            // Adding new active level
            bool found = false;
            uint256 length = activeLevelIds.length;
            for (uint256 i = 0; i < length; ) {
                if (activeLevelIds[i] == level) {
                    found = true;
                    break;
                }
                unchecked { i++; }
            }
            if (!found) {
                activeLevelIds.push(level);
            }
        } else if (!active && wasActive) {
            // FIX #3: Deactivating - remove from activeLevelIds
            _removeFromActiveLevels(level);
        }
        
        emit BonusLevelConfigured(level, amountETH, amountUSDC, claimsRemaining);
    }
    
    /**
     * @notice Deactivate a bonus level
     * @dev FIX #3: Auto-removes from activeLevelIds
     */
    function deactivateBonusLevel(uint256 level) external onlyOwner {
        bonusLevels[level].active = false;
        
        // FIX #3: Remove from active levels array
        _removeFromActiveLevels(level);
        
        emit BonusLevelDeactivated(level);
    }
    
    /**
     * @notice Remove level from activeLevelIds array
     * @dev FIX #3: Gas-efficient removal using swap-and-pop
     */
    function _removeFromActiveLevels(uint256 level) internal {
        uint256 length = activeLevelIds.length;
        for (uint256 i = 0; i < length; ) {
            if (activeLevelIds[i] == level) {
                // Swap with last element and pop
                activeLevelIds[i] = activeLevelIds[length - 1];
                activeLevelIds.pop();
                emit BonusLevelRemoved(level);
                break;
            }
            unchecked { i++; }
        }
    }
    
    function setEligibilityRules(
        bool checkLevel,
        bool checkScore,
        bool checkNFTOwnership,
        bool useAndLogic
    ) external onlyOwner {
        eligibilityRules = EligibilityRules({
            checkLevel: checkLevel,
            checkScore: checkScore,
            checkNFTOwnership: checkNFTOwnership,
            useAndLogic: useAndLogic
        });
        emit EligibilityRulesUpdated();
    }
    
    /**
     * @notice Deposit ETH bonus funds
     */
    function depositBonusFundsETH() external payable onlyOwner {
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Deposit USDC bonus funds
     * @dev Requires prior USDC approval
     */
    function depositBonusFundsUSDC(uint256 amount) external onlyOwner {
        IERC20 usdc = IERC20(BASE_USDC);
        
        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < amount) {
            revert InsufficientUSDCAllowance(amount, allowed);
        }
        
        bool success = usdc.transferFrom(msg.sender, address(this), amount);
        if (!success) revert USDCTransferFailed();
        
        bonusPoolBalanceUSDC += amount;
        emit BonusFundsDeposited(amount, PaymentCurrency.USDC);
    }
    
    /**
     * @notice Withdraw ETH bonus funds
     */
    function withdrawBonusFundsETH(uint256 amount) external onlyOwner nonReentrant {
        uint256 currentPool = bonusPoolBalanceETH;
        if (amount > currentPool) revert InsufficientBonusBalance();
        
        unchecked {
            bonusPoolBalanceETH = currentPool - amount;
        }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusFundsWithdrawn(amount, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Withdraw USDC bonus funds
     * @dev HARDENED: Uses safe USDC transfer
     */
    function withdrawBonusFundsUSDC(uint256 amount) external onlyOwner nonReentrant {
        uint256 currentPool = bonusPoolBalanceUSDC;
        if (amount > currentPool) revert InsufficientBonusBalance();
        
        unchecked {
            bonusPoolBalanceUSDC = currentPool - amount;
        }
        
        emit BonusFundsWithdrawn(amount, PaymentCurrency.USDC);
        
        // HARDENED: Use safe USDC transfer
        _safeUSDCTransfer(_contractOwner, amount);
    }
    
    // ============ ADMIN: OWNERSHIP & FUNDS ============
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = _contractOwner;
        _contractOwner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @notice Withdraw ETH (excluding bonus pool)
     */
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 contractBalance = address(this).balance;
        uint256 reserved = bonusPoolBalanceETH;
        
        if (contractBalance <= reserved) revert WithdrawFailed();
        
        uint256 withdrawable;
        unchecked {
            withdrawable = contractBalance - reserved;
        }
        
        (bool success, ) = payable(_contractOwner).call{value: withdrawable}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Withdraw USDC (excluding bonus pool)
     * @dev HARDENED: Uses safe USDC transfer
     */
    function withdrawUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 contractBalance = usdc.balanceOf(address(this));
        uint256 reserved = bonusPoolBalanceUSDC;
        
        if (contractBalance <= reserved) revert WithdrawFailed();
        
        uint256 withdrawable;
        unchecked {
            withdrawable = contractBalance - reserved;
        }
        
        // HARDENED: Use safe USDC transfer
        _safeUSDCTransfer(_contractOwner, withdrawable);
    }
    
    /**
     * @notice Emergency withdraw all ETH
     */
    function emergencyWithdrawAllETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        
        bonusPoolBalanceETH = 0;
        
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Emergency withdraw all USDC
     * @dev HARDENED: Uses safe USDC transfer
     */
    function emergencyWithdrawAllUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert WithdrawFailed();
        
        bonusPoolBalanceUSDC = 0;
        
        // HARDENED: Use safe USDC transfer
        _safeUSDCTransfer(_contractOwner, balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function totalSupply() external view returns (uint256) {
        return _totalMinted;
    }
    
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
    
    function exists(uint256 tokenId) external view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    function owner() external view returns (address) {
        return _contractOwner;
    }
    
    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }
    
    function getWalletMintCount(address wallet) external view returns (uint256) {
        return _walletData[wallet].mintCount;
    }
    
    function getWalletLastMintBlock(address wallet) external view returns (uint256) {
        return _walletData[wallet].lastMintBlock;
    }
    
    function hasClaimedLevel(address wallet, uint256 level) external view returns (bool) {
        return _walletData[wallet].claimedLevels[level];
    }
    
    function getTotalClaimedETH(address wallet) external view returns (uint256) {
        return _walletData[wallet].totalClaimedETH;
    }
    
    function getTotalClaimedUSDC(address wallet) external view returns (uint256) {
        return _walletData[wallet].totalClaimedUSDC;
    }
    
    function getActiveLevelIds() external view returns (uint256[] memory) {
        return activeLevelIds;
    }
    
    /**
     * @notice Get current mint price in active currency
     */
    function getCurrentMintPrice() external view returns (uint256 price, PaymentCurrency currency) {
        currency = currencyConfig.activeMintCurrency;
        price = currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
    }
    
    /**
     * @notice Get bonus level config
     */
    function getBonusLevelConfig(uint256 level) external view returns (
        uint256 amountETH,
        uint256 amountUSDC,
        bool active,
        uint256 claimsRemaining,
        uint256 minScore,
        bool requiresNFT
    ) {
        BonusConfig storage config = bonusLevels[level];
        return (
            config.amountETH,
            config.amountUSDC,
            config.active,
            config.claimsRemaining,
            config.minScore,
            config.requiresNFT
        );
    }
    
    /**
     * @notice Get USDC contract address (Base Mainnet)
     */
    function getUSDCAddress() external pure returns (address) {
        return BASE_USDC;
    }
    
    /**
     * @notice Check if on correct chain
     */
    function isBaseMainnet() external view returns (bool) {
        return block.chainid == BASE_MAINNET_CHAIN_ID;
    }
    
    function canMint(address wallet) external view returns (bool canMintResult, string memory reason) {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain - Base Mainnet only");
        if (mintingPaused) return (false, "Minting is paused");
        if (emergencyMintDisabled) return (false, "Emergency: minting disabled");
        if (denylistEnabled && denylist[wallet]) return (false, "Address is denylisted");
        if (allowlistEnabled && !allowlist[wallet]) return (false, "Address not allowlisted");
        
        PaymentCurrency currency = currencyConfig.activeMintCurrency;
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH payments disabled");
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC payments disabled");
        
        WalletData storage walletData = _walletData[wallet];
        
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            return (false, "Wallet mint limit reached");
        }
        
        if (mintCooldownBlocks > 0 && walletData.lastMintBlock > 0) {
            uint256 blocksSince = block.number - walletData.lastMintBlock;
            if (blocksSince < mintCooldownBlocks) {
                return (false, "Mint cooldown active");
            }
        }
        
        if (fcfsMintCap > 0 && _totalMinted >= fcfsMintCap) {
            return (false, "FCFS mint cap reached");
        }
        
        return (true, "Eligible to mint");
    }
    
    function canClaim(address wallet, uint256 level, uint256 userScore) external view returns (bool canClaimResult, string memory reason) {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain - Base Mainnet only");
        
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) return (false, "Claims are disabled");
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH payouts disabled");
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC payouts disabled");
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) return (false, "Invalid bonus level");
        
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) return (false, "No bonus configured for level");
        
        uint256 poolBalance = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > poolBalance) return (false, "Insufficient bonus pool");
        
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) return (false, "Total claim cap reached");
        
        if (currentMode == ClaimMode.FCFS && config.claimsRemaining == 0) {
            return (false, "Level claim cap reached");
        }
        
        if ((currentMode == ClaimMode.ONE_TIME || currentMode == ClaimMode.FCFS) && 
            _walletData[wallet].claimedLevels[level]) {
            return (false, "Already claimed this level");
        }
        
        // Note: Full eligibility check requires levelProof, this is a basic check
        EligibilityRules memory rules = eligibilityRules;
        if (rules.checkScore && config.minScore > 0 && userScore < config.minScore) {
            return (false, "Score requirement not met");
        }
        if (rules.checkNFTOwnership && config.requiresNFT && _balances[wallet] == 0) {
            return (false, "NFT ownership required");
        }
        if (rules.checkLevel) {
            return (true, "Eligible (level proof required)");
        }
        
        return (true, "Eligible to claim");
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        
        unchecked {
            _balances[to]++;
        }
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
        
        if (_isContract(to)) {
            if (!_checkOnERC721Received(address(0), to, tokenId, "")) {
                revert TransferToNonReceiver();
            }
        }
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != from) revert NotTokenOwner();
        
        // Clear approvals and emit event
        address approved = _tokenApprovals[tokenId];
        if (approved != address(0)) {
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
        if (_isContract(to)) {
            if (!_checkOnERC721Received(from, to, tokenId, data)) {
                revert TransferToNonReceiver();
            }
        }
    }
    
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return (
            spender == tokenOwner ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(tokenOwner, spender)
        );
    }
    
    function _isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }
    
    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) internal returns (bool) {
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            return retval == ERC721_RECEIVER_SELECTOR;
        } catch (bytes memory reason) {
            if (reason.length == 0) {
                revert TransferToNonReceiver();
            } else {
                assembly {
                    revert(add(32, reason), mload(reason))
                }
            }
        }
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
                buffer[digits] = bytes1(uint8(48 + (value % 10)));
                value /= 10;
            }
        }
        
        return string(buffer);
    }
    
    // ============ RECEIVE ETH ============
    
    /**
     * @notice Direct ETH transfers go to the bonus pool (owner only to prevent accidental deposits)
     * @dev HARDENED: Only contract owner can fund bonus pool via direct ETH transfer
     *      This prevents accidental ETH deposits from users that would be unrecoverable
     *      Users should interact via mint functions only
     */
    receive() external payable {
        // HARDENED: Only owner can directly fund the bonus pool
        // This prevents accidental ETH deposits from regular users
        if (msg.sender != _contractOwner) {
            revert NotContractOwner();
        }
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Fallback to reject calls with data that don't match any function
     * @dev Prevents accidental calls with wrong function selectors
     */
    fallback() external payable {
        revert(); // Reject all unrecognized calls
    }
}
