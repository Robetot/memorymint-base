// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraSafe
 * @author MemoryMint Team
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with dual-currency support (ETH/USDC)
 * @dev Optimized for Base Mainnet ONLY, OpenSea, Farcaster, BaseApp, and Coinbase Smart Wallet compatibility
 * 
 * @dev v5: Security hardening - kill switch, claims pause, price caps, API compatibility
 * 
 * CHANGELOG v5:
 * - CRITICAL #1: Added global kill switch for emergency situations
 * - CRITICAL #2: Added wrapper functions for API compatibility (mint, mintWithProof, etc.)
 * - CRITICAL #3: Added independent claims pause mechanism
 * - MEDIUM #1: Added minimum signature expiration duration (5 minutes)
 * - MEDIUM #2: Added maximum price caps (prevent accidental high fees)
 * - MEDIUM #3: Added balance validation safeguards in withdrawals
 * - MEDIUM #4: Enhanced event emissions
 * - LOW #1: Added batch mint operation for gas savings
 * - LOW #2: Full NatSpec documentation
 * 
 * PREVIOUS VERSIONS:
 * v4: Nonce-based replay protection, fixed signature expiration
 * v3: Dual-currency support (ETH + USDC)
 * v2: Production fixes (tx.origin disabled, level proof, signature expiration)
 * v1: Initial security hardening (CEI pattern, replay protection, denylist priority)
 */

// ============ INTERFACES ============

/**
 * @title IERC721Receiver
 * @notice Interface for contracts that want to support safeTransfers from ERC721 tokens
 */
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

/**
 * @title IERC20
 * @notice Minimal ERC20 interface for USDC interactions
 */
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
error ZeroAmount();
error InvalidNonce(uint256 expected, uint256 provided);
error SignatureExpirationTooFar();
error SignatureExpirationTooShort();  // v5: Minimum expiration duration
error ContractKilled();               // v5: Kill switch activated
error ClaimsPaused();                 // v5: Claims specifically paused
error PriceExceedsMaximum(uint256 price, uint256 maximum);  // v5: Price cap exceeded
error InsufficientContractBalance(uint256 requested, uint256 available);  // v5: Balance safeguard
error BatchSizeExceeded(uint256 size, uint256 maximum);  // v5: Batch limit

// ============ MAIN CONTRACT ============

/**
 * @title MemoryMintUltraSafe
 * @notice Production-grade ERC-721 NFT contract with dual-currency support
 * @dev Implements ERC-721, ERC-165, ERC-4906, with security hardening
 */
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
    
    // v5: Kill Switch & Claims Pause Events
    event KillSwitchActivated(address indexed activator, uint256 timestamp);
    event KillSwitchDeactivated(address indexed deactivator, uint256 timestamp);
    event ClaimsPausedUpdated(bool paused);
    event MaxPriceCapUpdated(PaymentCurrency currency, uint256 newCap);
    
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
    
    // v4+ Events
    event NonceIncremented(address indexed wallet, uint256 newNonce);
    event UnexpectedETHDeposit(address indexed sender, uint256 amount);
    
    // v5: Batch Events
    event BatchMinted(address indexed minter, uint256 startTokenId, uint256 quantity);
    
    // ============ ENUMS ============
    
    /**
     * @notice Claim mode for bonus distribution
     * @dev DISABLED = no claims, FCFS = first come first served with cap, etc.
     */
    enum ClaimMode {
        DISABLED,           // 0: No claims allowed
        FCFS,              // 1: First Come First Served with cap
        UNLIMITED,         // 2: Unlimited claims per wallet
        ONE_TIME,          // 3: One claim per wallet per level
        CUSTOM             // 4: Custom admin-defined rules
    }
    
    /**
     * @notice Anti-bot protection level
     * @dev STRICT includes tx.origin check which blocks smart wallets
     */
    enum AntiBotMode {
        DISABLED,          // 0: No anti-bot checks
        SOFT,              // 1: Basic checks only (denylist)
        MODERATE,          // 2: Standard protections (limit + cooldown, NO tx.origin)
        STRICT,            // 3: Maximum protection (includes tx.origin - BLOCKS SMART WALLETS)
        CUSTOM             // 4: Custom configuration
    }
    
    /**
     * @notice Payment currency type
     */
    enum PaymentCurrency {
        ETH,               // 0: Native ETH
        USDC               // 1: Base USDC (ERC-20)
    }
    
    // ============ STRUCTS ============
    
    /**
     * @notice Configuration for a bonus level
     * @param amountETH Bonus amount in ETH (wei)
     * @param amountUSDC Bonus amount in USDC (6 decimals)
     * @param active Whether this level is active
     * @param claimsRemaining For FCFS mode (0 = exhausted)
     * @param minScore Minimum score required (0 = no requirement)
     * @param requiresNFT Whether user must own an NFT to claim
     */
    struct BonusConfig {
        uint256 amountETH;
        uint256 amountUSDC;
        bool active;
        uint256 claimsRemaining;
        uint256 minScore;
        bool requiresNFT;
    }
    
    /**
     * @notice Per-wallet tracking data
     */
    struct WalletData {
        uint256 mintCount;
        uint256 lastMintBlock;
        mapping(uint256 => bool) claimedLevels;
        uint256 totalClaimedETH;
        uint256 totalClaimedUSDC;
    }
    
    /**
     * @notice Rules for claim eligibility
     */
    struct EligibilityRules {
        bool checkLevel;
        bool checkScore;
        bool checkNFTOwnership;
        bool useAndLogic;       // true = AND, false = OR
    }
    
    /**
     * @notice Currency configuration
     */
    struct CurrencyConfig {
        bool ethEnabled;
        bool usdcEnabled;
        PaymentCurrency activeMintCurrency;
        PaymentCurrency activeBonusCurrency;
    }
    
    // ============ CONSTANTS ============
    
    bytes4 private constant ERC721_RECEIVER_SELECTOR = 0x150b7a02;
    bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    bytes4 private constant INTERFACE_ID_ERC4906 = 0x49064906;
    
    /// @dev EIP-2 signature malleability bound
    uint256 private constant MAX_S_VALUE = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    
    /// @dev Base Mainnet chain ID
    uint256 private constant BASE_MAINNET_CHAIN_ID = 8453;
    
    /// @dev Base USDC contract address (official)
    address private constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    
    /// @dev v5: Minimum signature expiration (5 minutes) - prevents instant-expiry exploits
    uint256 private constant MIN_SIGNATURE_EXPIRATION = 300;
    
    /// @dev v5: Maximum batch size for batch operations
    uint256 private constant MAX_BATCH_SIZE = 50;
    
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
    uint256 public mintPriceETH;
    uint256 public mintPriceUSDC;
    bool public mintingPaused;
    bool public emergencyMintDisabled;
    
    // v5: Kill Switch & Claims Pause
    bool public killSwitch;           // Global emergency stop
    bool public claimsPaused;         // Independent claims pause
    
    // v5: Maximum Price Caps (prevent accidental/malicious high fees)
    uint256 public maxPriceETH;       // 0 = no cap
    uint256 public maxPriceUSDC;      // 0 = no cap
    
    // Currency Configuration
    CurrencyConfig public currencyConfig;
    
    // Anti-Bot Configuration
    AntiBotMode public antiBotMode;
    uint256 public walletMintLimit;
    uint256 public mintCooldownBlocks;
    bool public allowlistEnabled;
    bool public denylistEnabled;
    bool public signatureRequired;
    uint256 public fcfsMintCap;
    bool public txOriginCheck;
    
    mapping(address => bool) public allowlist;
    mapping(address => bool) public denylist;
    mapping(address => WalletData) private _walletData;
    address public signatureSigner;
    
    // Nonce-based replay protection
    mapping(address => uint256) private _nonces;
    
    // Signature tracking
    uint256 public signatureExpirationSeconds;
    mapping(bytes32 => uint256) private _signatureUsedAt;
    
    // Claim Bonus System - Dual Currency
    ClaimMode public claimMode;
    uint256 public totalClaimCap;
    uint256 public totalClaimsMade;
    uint256 public bonusPoolBalanceETH;
    uint256 public bonusPoolBalanceUSDC;
    EligibilityRules public eligibilityRules;
    
    mapping(uint256 => BonusConfig) public bonusLevels;
    uint256[] public activeLevelIds;
    
    // Reentrancy Guard
    uint256 private _reentrancyStatus;
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    
    // ============ MODIFIERS ============
    
    /**
     * @notice Restricts function to contract owner
     */
    modifier onlyOwner() {
        if (msg.sender != _contractOwner) revert NotContractOwner();
        _;
    }
    
    /**
     * @notice Prevents reentrancy attacks
     */
    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) revert ReentrancyGuard();
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }
    
    /**
     * @notice Ensures minting is not paused
     */
    modifier whenNotPaused() {
        if (mintingPaused) revert MintingPaused();
        if (emergencyMintDisabled) revert EmergencyMintDisabled();
        _;
    }
    
    /**
     * @notice v5: Ensures kill switch is not activated
     */
    modifier whenNotKilled() {
        if (killSwitch) revert ContractKilled();
        _;
    }
    
    /**
     * @notice v5: Ensures claims are not paused
     */
    modifier whenClaimsNotPaused() {
        if (claimsPaused) revert ClaimsPaused();
        _;
    }
    
    /**
     * @notice Ensures we're on Base Mainnet
     */
    modifier onlyBaseMainnet() {
        if (block.chainid != BASE_MAINNET_CHAIN_ID) {
            revert WrongChain(BASE_MAINNET_CHAIN_ID, block.chainid);
        }
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize the NFT contract
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param baseURI_ Base URI for token metadata
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
        
        // Production-safe defaults
        antiBotMode = AntiBotMode.MODERATE;
        walletMintLimit = 10;
        mintCooldownBlocks = 2;
        txOriginCheck = false;
        denylistEnabled = true;
        signatureRequired = true;
        signatureExpirationSeconds = 3600; // 1 hour
        
        claimMode = ClaimMode.DISABLED;
        signatureSigner = msg.sender;
        
        // v5: Kill switch and claims pause disabled by default
        killSwitch = false;
        claimsPaused = false;
        
        // v5: Default price caps (10 ETH, 10000 USDC) - can be adjusted
        maxPriceETH = 10 ether;
        maxPriceUSDC = 10000 * 1e6;  // 10000 USDC
        
        currencyConfig = CurrencyConfig({
            ethEnabled: true,
            usdcEnabled: false,
            activeMintCurrency: PaymentCurrency.ETH,
            activeBonusCurrency: PaymentCurrency.ETH
        });
        
        mintPriceETH = 0;
        mintPriceUSDC = 0;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============ ERC-165 ============
    
    /**
     * @notice Check if contract supports an interface
     * @param interfaceId Interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == INTERFACE_ID_ERC165 ||
            interfaceId == INTERFACE_ID_ERC721 ||
            interfaceId == INTERFACE_ID_ERC721_METADATA ||
            interfaceId == INTERFACE_ID_ERC4906;
    }
    
    // ============ ERC-721 METADATA ============
    
    /**
     * @notice Get token name
     * @return Token name
     */
    function name() external view returns (string memory) { return _name; }
    
    /**
     * @notice Get token symbol
     * @return Token symbol
     */
    function symbol() external view returns (string memory) { return _symbol; }
    
    /**
     * @notice Get token URI
     * @param tokenId Token ID
     * @return Token metadata URI
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) return customURI;
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }
    
    // ============ ERC-721 CORE ============
    
    /**
     * @notice Get balance of address
     * @param owner_ Address to query
     * @return Number of tokens owned
     */
    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }
    
    /**
     * @notice Get owner of token
     * @param tokenId Token ID
     * @return Owner address
     */
    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotExist(tokenId);
        return tokenOwner;
    }
    
    /**
     * @notice Approve address to transfer token
     * @param to Address to approve
     * @param tokenId Token ID
     */
    function approve(address to, uint256 tokenId) external {
        address tokenOwner = ownerOf(tokenId);
        if (to == tokenOwner) revert SelfApproval();
        if (msg.sender != tokenOwner && !isApprovedForAll(tokenOwner, msg.sender)) revert NotApproved();
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }
    
    /**
     * @notice Get approved address for token
     * @param tokenId Token ID
     * @return Approved address
     */
    function getApproved(uint256 tokenId) public view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        return _tokenApprovals[tokenId];
    }
    
    /**
     * @notice Set approval for all tokens
     * @param operator Address to approve
     * @param approved Approval status
     */
    function setApprovalForAll(address operator, bool approved) external {
        if (operator == msg.sender) revert SelfApproval();
        if (operator == address(0)) revert ZeroAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    /**
     * @notice Check if operator is approved for all tokens
     * @param owner_ Token owner
     * @param operator Operator address
     * @return Approval status
     */
    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }
    
    /**
     * @notice Transfer token
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token ID
     */
    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _transfer(from, to, tokenId);
    }
    
    /**
     * @notice Safe transfer token
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token ID
     */
    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    /**
     * @notice Safe transfer token with data
     * @param from Current owner
     * @param to New owner
     * @param tokenId Token ID
     * @param data Additional data
     */
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _safeTransfer(from, to, tokenId, data);
    }
    
    // ============ MINTING - ETH ============
    
    /**
     * @notice Mint NFT with ETH (no signature required mode)
     * @param metadataURI Token metadata URI
     * @return tokenId Minted token ID
     */
    function mintNFT(string calldata metadataURI) 
        external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with ETH and signature verification
     * @dev Requires nonce parameter for replay protection
     * @param metadataURI Token metadata URI
     * @param nonce Current nonce for wallet (get via getNonce())
     * @param expiration Signature expiration timestamp
     * @param signature Admin signature
     * @return tokenId Minted token ID
     */
    function mintWithSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    // ============ v5: API COMPATIBILITY WRAPPER FUNCTIONS ============
    
    /**
     * @notice Simple mint function (API compatibility)
     * @dev Wrapper for mintNFT with empty metadata
     * @return tokenId Minted token ID
     */
    function mint() external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, "");
    }
    
    /**
     * @notice Mint with proof/signature (API compatibility)
     * @dev Wrapper for mintWithSignature
     * @param nonce Current nonce for wallet
     * @param expiration Signature expiration timestamp
     * @param signature Admin signature
     * @return tokenId Minted token ID
     */
    function mintWithProof(
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, "");
    }
    
    /**
     * @notice Mint to specific address (admin or verified)
     * @dev Wrapper for minting to a different address
     * @param to Recipient address
     * @param metadataURI Token metadata URI
     * @return tokenId Minted token ID
     */
    function mintTo(address to, string calldata metadataURI) 
        external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) 
    {
        if (to == address(0)) revert ZeroAddress();
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(to, metadataURI);
    }
    
    // ============ v5: BATCH MINTING ============
    
    /**
     * @notice Batch mint multiple NFTs
     * @dev Gas optimized for multiple mints
     * @param quantity Number of NFTs to mint
     * @param baseMetadataURI Base metadata URI (tokenId appended)
     * @return startTokenId First minted token ID
     */
    function batchMint(uint256 quantity, string calldata baseMetadataURI) 
        external payable nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) 
    {
        if (quantity == 0) revert ZeroAmount();
        if (quantity > MAX_BATCH_SIZE) revert BatchSizeExceeded(quantity, MAX_BATCH_SIZE);
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        
        uint256 totalCost = mintPriceETH * quantity;
        if (msg.value < totalCost) revert InsufficientPayment(totalCost, msg.value);
        
        uint256 startTokenId = _nextTokenId;
        
        for (uint256 i = 0; i < quantity; ) {
            _executeMintInternal(msg.sender);
            unchecked { i++; }
        }
        
        // Set metadata for all minted tokens
        if (bytes(baseMetadataURI).length > 0) {
            for (uint256 i = 0; i < quantity; ) {
                uint256 tokenId = startTokenId + i;
                _tokenURIs[tokenId] = string(abi.encodePacked(baseMetadataURI, _toString(tokenId)));
                emit MetadataUpdate(tokenId);
                unchecked { i++; }
            }
        }
        
        emit BatchMinted(msg.sender, startTokenId, quantity);
        return startTokenId;
    }
    
    // ============ MINTING - USDC ============
    
    /**
     * @notice Mint NFT with USDC
     * @param metadataURI Token metadata URI
     * @return tokenId Minted token ID
     */
    function mintWithUSDC(string calldata metadataURI) 
        external nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        _performAntiBotChecks(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @notice Mint with USDC and signature verification
     * @param metadataURI Token metadata URI
     * @param nonce Current nonce for wallet
     * @param expiration Signature expiration timestamp
     * @param signature Admin signature
     * @return tokenId Minted token ID
     */
    function mintWithUSDCAndSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external nonReentrant whenNotPaused whenNotKilled onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    /**
     * @dev Internal mint execution with metadata
     */
    function _executeMint(address minter, string calldata metadataURI) internal returns (uint256) {
        uint256 tokenId = _executeMintInternal(minter);
        
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
    
    /**
     * @dev Internal mint execution without metadata (for batch)
     */
    function _executeMintInternal(address minter) internal returns (uint256) {
        uint256 totalMinted = _totalMinted;
        if (fcfsMintCap > 0 && totalMinted >= fcfsMintCap) revert FCFSCapReached(fcfsMintCap);
        
        uint256 tokenId = _nextTokenId;
        
        unchecked {
            _nextTokenId = tokenId + 1;
            _totalMinted = totalMinted + 1;
        }
        
        WalletData storage walletData = _walletData[minter];
        unchecked { walletData.mintCount++; }
        walletData.lastMintBlock = block.number;
        
        _mint(minter, tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Process USDC payment
     */
    function _processUSDCPayment(address payer, uint256 amount) internal {
        if (amount == 0) return;
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(payer);
        if (balance < amount) revert InsufficientUSDCBalance(amount, balance);
        
        uint256 allowed = usdc.allowance(payer, address(this));
        if (allowed < amount) revert InsufficientUSDCAllowance(amount, allowed);
        
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, payer, address(this), amount)
        );
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    /**
     * @dev Safe USDC transfer
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
     * @notice Claim bonus for a level
     * @param level Bonus level to claim
     * @param gameLevel User's game level
     * @param userScore User's score
     * @param levelProof Signed proof of level achievement
     * @return amount Bonus amount claimed
     */
    function claimBonus(uint256 level, uint256 gameLevel, uint256 userScore, bytes calldata levelProof) 
        external nonReentrant whenNotKilled whenClaimsNotPaused onlyBaseMainnet returns (uint256) 
    {
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
        
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) revert ClaimCapReached();
        
        uint256 remaining = config.claimsRemaining;
        if (currentMode == ClaimMode.FCFS && remaining == 0) revert LevelClaimCapReached(level);
        
        WalletData storage walletData = _walletData[msg.sender];
        if ((currentMode == ClaimMode.ONE_TIME || currentMode == ClaimMode.FCFS) && walletData.claimedLevels[level]) {
            revert AlreadyClaimed();
        }
        
        if (!_checkEligibility(msg.sender, level, gameLevel, userScore, levelProof)) revert NotEligible();
        
        // CEI: Effects before interactions
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked { bonusPoolBalanceETH = currentPool - bonusAmount; }
        } else {
            unchecked { bonusPoolBalanceUSDC = currentPool - bonusAmount; }
        }
        
        unchecked { totalClaimsMade++; }
        walletData.claimedLevels[level] = true;
        
        if (payoutCurrency == PaymentCurrency.ETH) {
            unchecked { walletData.totalClaimedETH += bonusAmount; }
        } else {
            unchecked { walletData.totalClaimedUSDC += bonusAmount; }
        }
        
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked { config.claimsRemaining = remaining - 1; }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount, payoutCurrency);
        
        // CEI: Interactions last
        if (payoutCurrency == PaymentCurrency.ETH) {
            (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
            if (!success) revert WithdrawFailed();
        } else {
            _safeUSDCTransfer(msg.sender, bonusAmount);
        }
        
        return bonusAmount;
    }
    
    /**
     * @dev Check eligibility for bonus claim
     */
    function _checkEligibility(
        address wallet, uint256 level, uint256 gameLevel, uint256 userScore, bytes calldata levelProof
    ) internal view returns (bool) {
        BonusConfig storage config = bonusLevels[level];
        EligibilityRules memory rules = eligibilityRules;
        
        bool levelCheck = true;
        bool scoreCheck = true;
        bool nftCheck = true;
        
        if (rules.checkLevel) {
            if (levelProof.length == 0) return false;
            
            bytes32 levelHash = keccak256(abi.encodePacked(wallet, gameLevel, level, address(this), block.chainid));
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", levelHash));
            
            address recovered = _recoverSigner(ethSignedHash, levelProof);
            if (recovered != signatureSigner || recovered == address(0)) return false;
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
            if (!rules.checkLevel && !rules.checkScore && !rules.checkNFTOwnership) return true;
            return levelCheck || scoreCheck || nftCheck;
        }
    }
    
    // ============ ANTI-BOT ============
    
    /**
     * @dev Perform anti-bot checks for unsigned mints
     */
    function _performAntiBotChecks(address wallet) internal view {
        if (denylistEnabled && denylist[wallet]) revert AddressDenylisted();
        
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        if (allowlistEnabled) {
            if (allowlist[wallet]) return;
            else revert NotAllowlisted();
        }
        
        WalletData storage walletData = _walletData[wallet];
        
        if (mode == AntiBotMode.STRICT && txOriginCheck && tx.origin != wallet) revert BotDetected();
        
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        uint256 cooldown = mintCooldownBlocks;
        uint256 lastBlock = walletData.lastMintBlock;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSince = block.number - lastBlock;
            if (blocksSince < cooldown) {
                unchecked { revert MintCooldownActive(cooldown - blocksSince); }
            }
        }
    }
    
    /**
     * @dev Perform anti-bot checks for signed mints (less strict)
     */
    function _performAntiBotChecksForSignedMint(address wallet) internal view {
        AntiBotMode mode = antiBotMode;
        if (mode == AntiBotMode.DISABLED) return;
        
        if (allowlistEnabled) {
            if (allowlist[wallet]) return;
            else revert NotAllowlisted();
        }
        
        WalletData storage walletData = _walletData[wallet];
        
        if (mode == AntiBotMode.STRICT && txOriginCheck && tx.origin != wallet) revert BotDetected();
        
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        uint256 cooldown = mintCooldownBlocks;
        uint256 lastBlock = walletData.lastMintBlock;
        if (cooldown > 0 && lastBlock > 0) {
            uint256 blocksSince = block.number - lastBlock;
            if (blocksSince < cooldown) {
                unchecked { revert MintCooldownActive(cooldown - blocksSince); }
            }
        }
    }
    
    /**
     * @dev Verify mint signature with nonce-based replay protection
     */
    function _verifyMintSignature(
        address wallet,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) internal {
        // 1. Validate nonce matches expected value
        uint256 expectedNonce = _nonces[wallet];
        if (nonce != expectedNonce) {
            revert InvalidNonce(expectedNonce, nonce);
        }
        
        // 2. Check if signature has already expired
        if (block.timestamp > expiration) {
            revert SignatureExpired();
        }
        
        // v5: Check minimum expiration duration (prevent instant-expiry exploits)
        if (expiration < block.timestamp + MIN_SIGNATURE_EXPIRATION) {
            revert SignatureExpirationTooShort();
        }
        
        // 3. Validate expiration is within allowed window
        if (signatureExpirationSeconds > 0) {
            if (expiration > block.timestamp + signatureExpirationSeconds) {
                revert SignatureExpirationTooFar();
            }
        }
        
        // 4. Build message hash WITH NONCE
        bytes32 messageHash = keccak256(
            abi.encodePacked(wallet, nonce, address(this), block.chainid, expiration)
        );
        
        // 5. Check if signature already used
        if (_signatureUsedAt[messageHash] > 0) {
            revert InvalidSignature();
        }
        
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        // 6. Recover and verify signer
        address recovered = _recoverSigner(ethSignedHash, signature);
        if (recovered != signatureSigner || recovered == address(0)) {
            revert InvalidSignature();
        }
        
        // 7. Mark signature as used
        _signatureUsedAt[messageHash] = block.timestamp;
        
        // 8. Increment nonce for wallet
        unchecked {
            _nonces[wallet] = expectedNonce + 1;
        }
        emit NonceIncremented(wallet, expectedNonce + 1);
    }
    
    /**
     * @dev Recover signer from signature
     */
    function _recoverSigner(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        if (uint256(s) > MAX_S_VALUE) return address(0);
        if (v < 27) unchecked { v += 27; }
        if (v != 27 && v != 28) return address(0);
        
        return ecrecover(hash, v, r, s);
    }
    
    // ============ v5: KILL SWITCH (CRITICAL) ============
    
    /**
     * @notice Activate global kill switch
     * @dev Stops ALL minting and claiming operations immediately
     */
    function activateKillSwitch() external onlyOwner {
        killSwitch = true;
        emit KillSwitchActivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Deactivate global kill switch
     * @dev Re-enables minting and claiming operations
     */
    function deactivateKillSwitch() external onlyOwner {
        killSwitch = false;
        emit KillSwitchDeactivated(msg.sender, block.timestamp);
    }
    
    /**
     * @notice Pause claims independently of minting
     * @param paused Whether claims should be paused
     */
    function setClaimsPaused(bool paused) external onlyOwner {
        claimsPaused = paused;
        emit ClaimsPausedUpdated(paused);
    }
    
    // ============ v5: PRICE CAPS ============
    
    /**
     * @notice Set maximum price cap for ETH
     * @param maxPrice Maximum allowed price in wei (0 = no cap)
     */
    function setMaxPriceETH(uint256 maxPrice) external onlyOwner {
        maxPriceETH = maxPrice;
        emit MaxPriceCapUpdated(PaymentCurrency.ETH, maxPrice);
    }
    
    /**
     * @notice Set maximum price cap for USDC
     * @param maxPrice Maximum allowed price in USDC (6 decimals, 0 = no cap)
     */
    function setMaxPriceUSDC(uint256 maxPrice) external onlyOwner {
        maxPriceUSDC = maxPrice;
        emit MaxPriceCapUpdated(PaymentCurrency.USDC, maxPrice);
    }
    
    // ============ ADMIN: CURRENCY ============
    
    /**
     * @notice Enable/disable ETH payments
     * @param enabled Whether ETH is enabled
     */
    function setETHEnabled(bool enabled) external onlyOwner {
        currencyConfig.ethEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.ETH, enabled);
    }
    
    /**
     * @notice Enable/disable USDC payments
     * @param enabled Whether USDC is enabled
     */
    function setUSDCEnabled(bool enabled) external onlyOwner {
        currencyConfig.usdcEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.USDC, enabled);
    }
    
    /**
     * @notice Set active mint currency
     * @param currency Currency to use for minting
     */
    function setActiveMintCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeMintCurrency = currency;
        emit ActiveMintCurrencyUpdated(currency);
    }
    
    /**
     * @notice Set active bonus currency
     * @param currency Currency to use for bonuses
     */
    function setActiveBonusCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeBonusCurrency = currency;
        emit ActiveBonusCurrencyUpdated(currency);
    }
    
    // ============ ADMIN: MINTING ============
    
    /**
     * @notice Set mint price in ETH
     * @param newPrice New price in wei
     */
    function setMintPriceETH(uint256 newPrice) external onlyOwner {
        // v5: Price cap validation
        if (maxPriceETH > 0 && newPrice > maxPriceETH) {
            revert PriceExceedsMaximum(newPrice, maxPriceETH);
        }
        uint256 oldPrice = mintPriceETH;
        mintPriceETH = newPrice;
        emit MintPriceUpdated(PaymentCurrency.ETH, oldPrice, newPrice);
    }
    
    /**
     * @notice Set mint price in USDC
     * @param newPrice New price in USDC (6 decimals)
     */
    function setMintPriceUSDC(uint256 newPrice) external onlyOwner {
        // v5: Price cap validation
        if (maxPriceUSDC > 0 && newPrice > maxPriceUSDC) {
            revert PriceExceedsMaximum(newPrice, maxPriceUSDC);
        }
        uint256 oldPrice = mintPriceUSDC;
        mintPriceUSDC = newPrice;
        emit MintPriceUpdated(PaymentCurrency.USDC, oldPrice, newPrice);
    }
    
    /**
     * @notice Set base URI for token metadata
     * @param newBaseURI New base URI
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
        if (_totalMinted > 0) emit BatchMetadataUpdate(1, _nextTokenId - 1);
    }
    
    /**
     * @notice Pause/unpause minting
     * @param paused Whether minting should be paused
     */
    function pauseMinting(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPausedUpdated(paused);
    }
    
    /**
     * @notice Set emergency mint disabled status
     * @param disabled Whether emergency mint is disabled
     */
    function setEmergencyMintDisabled(bool disabled) external onlyOwner {
        emergencyMintDisabled = disabled;
        emit EmergencyMintDisabledUpdated(disabled);
    }
    
    // ============ ADMIN: ANTI-BOT ============
    
    /**
     * @notice Set anti-bot mode
     * @param mode Anti-bot protection level
     */
    function setAntiBotMode(AntiBotMode mode) external onlyOwner {
        antiBotMode = mode;
        if (mode == AntiBotMode.STRICT) txOriginCheck = true;
        else if (mode == AntiBotMode.MODERATE || mode == AntiBotMode.SOFT) txOriginCheck = false;
        emit AntiBotModeUpdated(mode, txOriginCheck);
    }
    
    /**
     * @notice Set tx.origin check
     * @param enabled Whether to check tx.origin
     */
    function setTxOriginCheck(bool enabled) external onlyOwner {
        txOriginCheck = enabled;
        emit AntiBotModeUpdated(antiBotMode, enabled);
    }
    
    /**
     * @notice Set wallet mint limit
     * @param limit Maximum mints per wallet (0 = unlimited)
     */
    function setWalletMintLimit(uint256 limit) external onlyOwner {
        walletMintLimit = limit;
        emit WalletMintLimitUpdated(limit);
    }
    
    /**
     * @notice Set mint cooldown in blocks
     * @param blocks Cooldown period (0 = no cooldown)
     */
    function setMintCooldown(uint256 blocks) external onlyOwner {
        mintCooldownBlocks = blocks;
        emit MintCooldownUpdated(blocks);
    }
    
    /**
     * @notice Set FCFS mint cap
     * @param cap Maximum total mints (0 = unlimited)
     */
    function setFCFSMintCap(uint256 cap) external onlyOwner {
        fcfsMintCap = cap;
        emit FCFSMintCapUpdated(cap);
    }
    
    /**
     * @notice Enable/disable allowlist
     * @param enabled Whether allowlist is enabled
     */
    function setAllowlistEnabled(bool enabled) external onlyOwner { allowlistEnabled = enabled; }
    
    /**
     * @notice Enable/disable denylist
     * @param enabled Whether denylist is enabled
     */
    function setDenylistEnabled(bool enabled) external onlyOwner { denylistEnabled = enabled; }
    
    /**
     * @notice Update allowlist for multiple wallets
     * @param wallets Wallet addresses
     * @param status Allowlist status
     */
    function updateAllowlist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            if (wallets[i] != address(0)) {
                allowlist[wallets[i]] = status;
                emit AllowlistUpdated(wallets[i], status);
            }
            unchecked { i++; }
        }
    }
    
    /**
     * @notice Update denylist for multiple wallets
     * @param wallets Wallet addresses
     * @param status Denylist status
     */
    function updateDenylist(address[] calldata wallets, bool status) external onlyOwner {
        uint256 length = wallets.length;
        for (uint256 i = 0; i < length; ) {
            if (wallets[i] != address(0)) {
                denylist[wallets[i]] = status;
                emit DenylistUpdated(wallets[i], status);
            }
            unchecked { i++; }
        }
    }
    
    /**
     * @notice Set signature requirement
     * @param required Whether signature is required
     */
    function setSignatureRequired(bool required) external onlyOwner { signatureRequired = required; }
    
    /**
     * @notice Set signature signer address
     * @param signer New signer address
     */
    function setSignatureSigner(address signer) external onlyOwner {
        signatureSigner = signer;
        emit SignatureSignerUpdated(signer);
    }
    
    /**
     * @notice Set signature expiration window
     * @param seconds_ Expiration window in seconds
     */
    function setSignatureExpiration(uint256 seconds_) external onlyOwner {
        signatureExpirationSeconds = seconds_;
        emit SignatureExpirationUpdated(seconds_);
    }
    
    // ============ ADMIN: CLAIM BONUS ============
    
    /**
     * @notice Set claim mode
     * @param mode Claim mode
     */
    function setClaimMode(ClaimMode mode) external onlyOwner {
        claimMode = mode;
        emit ClaimModeUpdated(mode);
    }
    
    /**
     * @notice Set total claim cap
     * @param cap Maximum total claims (0 = unlimited)
     */
    function setTotalClaimCap(uint256 cap) external onlyOwner {
        totalClaimCap = cap;
        emit ClaimCapUpdated(cap);
    }
    
    /**
     * @notice Configure a bonus level
     * @param level Level ID
     * @param amountETH Bonus amount in ETH
     * @param amountUSDC Bonus amount in USDC
     * @param active Whether level is active
     * @param claimsRemaining Claims remaining for FCFS
     * @param minScore Minimum score required
     * @param requiresNFT Whether NFT ownership is required
     */
    function configureBonusLevel(
        uint256 level, uint256 amountETH, uint256 amountUSDC, bool active,
        uint256 claimsRemaining, uint256 minScore, bool requiresNFT
    ) external onlyOwner {
        BonusConfig storage config = bonusLevels[level];
        bool wasActive = config.active;
        
        config.amountETH = amountETH;
        config.amountUSDC = amountUSDC;
        config.active = active;
        config.claimsRemaining = claimsRemaining;
        config.minScore = minScore;
        config.requiresNFT = requiresNFT;
        
        if (active && !wasActive) {
            if (!_isLevelInActiveArray(level)) {
                activeLevelIds.push(level);
            }
        } else if (!active && wasActive) {
            _removeAllFromActiveLevels(level);
        }
        
        emit BonusLevelConfigured(level, amountETH, amountUSDC, claimsRemaining);
    }
    
    /**
     * @notice Deactivate a bonus level
     * @param level Level ID
     */
    function deactivateBonusLevel(uint256 level) external onlyOwner {
        bonusLevels[level].active = false;
        _removeAllFromActiveLevels(level);
        emit BonusLevelDeactivated(level);
    }
    
    /**
     * @dev Check if level exists in activeLevelIds
     */
    function _isLevelInActiveArray(uint256 level) internal view returns (bool) {
        uint256 length = activeLevelIds.length;
        for (uint256 i = 0; i < length; ) {
            if (activeLevelIds[i] == level) return true;
            unchecked { i++; }
        }
        return false;
    }
    
    /**
     * @dev Remove ALL instances of level from activeLevelIds
     */
    function _removeAllFromActiveLevels(uint256 level) internal {
        uint256 length = activeLevelIds.length;
        uint256 writeIndex = 0;
        
        for (uint256 readIndex = 0; readIndex < length; ) {
            if (activeLevelIds[readIndex] != level) {
                if (writeIndex != readIndex) {
                    activeLevelIds[writeIndex] = activeLevelIds[readIndex];
                }
                unchecked { writeIndex++; }
            }
            unchecked { readIndex++; }
        }
        
        uint256 toRemove = length - writeIndex;
        for (uint256 i = 0; i < toRemove; ) {
            activeLevelIds.pop();
            unchecked { i++; }
        }
        
        if (toRemove > 0) emit BonusLevelRemoved(level);
    }
    
    /**
     * @notice Set eligibility rules
     * @param checkLevel Whether to check level proof
     * @param checkScore Whether to check score
     * @param checkNFTOwnership Whether to check NFT ownership
     * @param useAndLogic Whether to use AND (true) or OR (false) logic
     */
    function setEligibilityRules(bool checkLevel, bool checkScore, bool checkNFTOwnership, bool useAndLogic) external onlyOwner {
        eligibilityRules = EligibilityRules(checkLevel, checkScore, checkNFTOwnership, useAndLogic);
        emit EligibilityRulesUpdated();
    }
    
    /**
     * @notice Deposit ETH to bonus pool
     */
    function depositBonusFundsETH() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Deposit USDC to bonus pool
     * @param amount Amount to deposit
     */
    function depositBonusFundsUSDC(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < amount) revert InsufficientUSDCAllowance(amount, allowed);
        
        (bool success, bytes memory data) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, address(this), amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) revert USDCTransferFailed();
        
        bonusPoolBalanceUSDC += amount;
        emit BonusFundsDeposited(amount, PaymentCurrency.USDC);
    }
    
    /**
     * @notice Withdraw ETH from bonus pool
     * @param amount Amount to withdraw
     */
    function withdrawBonusFundsETH(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceETH) revert InsufficientBonusBalance();
        
        // v5: Balance safeguard
        if (amount > address(this).balance) {
            revert InsufficientContractBalance(amount, address(this).balance);
        }
        
        unchecked { bonusPoolBalanceETH -= amount; }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusFundsWithdrawn(amount, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Withdraw USDC from bonus pool
     * @param amount Amount to withdraw
     */
    function withdrawBonusFundsUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceUSDC) revert InsufficientBonusBalance();
        
        // v5: Balance safeguard
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 contractBalance = usdc.balanceOf(address(this));
        if (amount > contractBalance) {
            revert InsufficientContractBalance(amount, contractBalance);
        }
        
        unchecked { bonusPoolBalanceUSDC -= amount; }
        emit BonusFundsWithdrawn(amount, PaymentCurrency.USDC);
        _safeUSDCTransfer(_contractOwner, amount);
    }
    
    // ============ ADMIN: OWNERSHIP & FUNDS ============
    
    /**
     * @notice Transfer contract ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }
    
    /**
     * @notice Withdraw accumulated ETH (excluding bonus pool)
     */
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 withdrawable = address(this).balance - bonusPoolBalanceETH;
        if (withdrawable == 0) revert WithdrawFailed();
        
        (bool success, ) = payable(_contractOwner).call{value: withdrawable}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Withdraw accumulated USDC (excluding bonus pool)
     */
    function withdrawUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 withdrawable = usdc.balanceOf(address(this)) - bonusPoolBalanceUSDC;
        if (withdrawable == 0) revert WithdrawFailed();
        _safeUSDCTransfer(_contractOwner, withdrawable);
    }
    
    /**
     * @notice Emergency withdraw all ETH (including bonus pool)
     */
    function emergencyWithdrawAllETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceETH = 0;
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }
    
    /**
     * @notice Emergency withdraw all USDC (including bonus pool)
     */
    function emergencyWithdrawAllUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceUSDC = 0;
        _safeUSDCTransfer(_contractOwner, balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get total supply
     * @return Total minted tokens
     */
    function totalSupply() external view returns (uint256) { return _totalMinted; }
    
    /**
     * @notice Get next token ID
     * @return Next token ID to be minted
     */
    function nextTokenId() external view returns (uint256) { return _nextTokenId; }
    
    /**
     * @notice Check if token exists
     * @param tokenId Token ID
     * @return Whether token exists
     */
    function exists(uint256 tokenId) external view returns (bool) { return _owners[tokenId] != address(0); }
    
    /**
     * @notice Get contract owner
     * @return Owner address
     */
    function owner() external view returns (address) { return _contractOwner; }
    
    /**
     * @notice Get base URI
     * @return Base token URI
     */
    function baseURI() external view returns (string memory) { return _baseTokenURI; }
    
    /**
     * @notice Get current nonce for wallet
     * @param wallet Wallet address
     * @return Current nonce
     */
    function getNonce(address wallet) external view returns (uint256) {
        return _nonces[wallet];
    }
    
    /**
     * @notice Get wallet mint count
     * @param wallet Wallet address
     * @return Number of mints
     */
    function getWalletMintCount(address wallet) external view returns (uint256) { return _walletData[wallet].mintCount; }
    
    /**
     * @notice Get wallet last mint block
     * @param wallet Wallet address
     * @return Last mint block number
     */
    function getWalletLastMintBlock(address wallet) external view returns (uint256) { return _walletData[wallet].lastMintBlock; }
    
    /**
     * @notice Check if wallet has claimed a level
     * @param wallet Wallet address
     * @param level Level ID
     * @return Whether level was claimed
     */
    function hasClaimedLevel(address wallet, uint256 level) external view returns (bool) { return _walletData[wallet].claimedLevels[level]; }
    
    /**
     * @notice Get total ETH claimed by wallet
     * @param wallet Wallet address
     * @return Total claimed in ETH
     */
    function getTotalClaimedETH(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedETH; }
    
    /**
     * @notice Get total USDC claimed by wallet
     * @param wallet Wallet address
     * @return Total claimed in USDC
     */
    function getTotalClaimedUSDC(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedUSDC; }
    
    /**
     * @notice Get all active level IDs
     * @return Array of active level IDs
     */
    function getActiveLevelIds() external view returns (uint256[] memory) { return activeLevelIds; }
    
    /**
     * @notice Get current mint price and currency
     * @return price Current mint price
     * @return currency Active currency
     */
    function getCurrentMintPrice() external view returns (uint256 price, PaymentCurrency currency) {
        currency = currencyConfig.activeMintCurrency;
        price = currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
    }
    
    /**
     * @notice Get bonus level configuration
     * @param level Level ID
     * @return amountETH Bonus amount in ETH
     * @return amountUSDC Bonus amount in USDC
     * @return active Whether level is active
     * @return claimsRemaining Claims remaining
     * @return minScore Minimum score required
     * @return requiresNFT Whether NFT is required
     */
    function getBonusLevelConfig(uint256 level) external view returns (
        uint256 amountETH, uint256 amountUSDC, bool active, uint256 claimsRemaining, uint256 minScore, bool requiresNFT
    ) {
        BonusConfig storage config = bonusLevels[level];
        return (config.amountETH, config.amountUSDC, config.active, config.claimsRemaining, config.minScore, config.requiresNFT);
    }
    
    /**
     * @notice Get USDC contract address
     * @return USDC address on Base
     */
    function getUSDCAddress() external pure returns (address) { return BASE_USDC; }
    
    /**
     * @notice Check if on Base Mainnet
     * @return Whether current chain is Base Mainnet
     */
    function isBaseMainnet() external view returns (bool) { return block.chainid == BASE_MAINNET_CHAIN_ID; }
    
    /**
     * @notice v5: Get contract status
     * @return isKilled Kill switch status
     * @return isMintingPaused Minting pause status
     * @return isClaimsPaused Claims pause status
     */
    function getContractStatus() external view returns (bool isKilled, bool isMintingPaused, bool isClaimsPaused) {
        return (killSwitch, mintingPaused, claimsPaused);
    }
    
    /**
     * @notice Check if wallet can mint
     * @param wallet Wallet address
     * @return canMintResult Whether wallet can mint
     * @return reason Reason if cannot mint
     */
    function canMint(address wallet) external view returns (bool canMintResult, string memory reason) {
        if (killSwitch) return (false, "Contract killed");
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain");
        if (mintingPaused) return (false, "Paused");
        if (emergencyMintDisabled) return (false, "Emergency disabled");
        if (denylistEnabled && denylist[wallet]) return (false, "Denylisted");
        if (allowlistEnabled && !allowlist[wallet]) return (false, "Not allowlisted");
        
        PaymentCurrency currency = currencyConfig.activeMintCurrency;
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH disabled");
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC disabled");
        
        WalletData storage walletData = _walletData[wallet];
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) return (false, "Wallet limit");
        if (mintCooldownBlocks > 0 && walletData.lastMintBlock > 0 && block.number - walletData.lastMintBlock < mintCooldownBlocks) {
            return (false, "Cooldown");
        }
        if (fcfsMintCap > 0 && _totalMinted >= fcfsMintCap) return (false, "Cap reached");
        
        return (true, "Eligible");
    }
    
    /**
     * @notice Check if wallet can claim bonus
     * @param wallet Wallet address
     * @param level Bonus level
     * @param userScore User's score
     * @param levelProof Optional level proof
     * @return canClaimResult Whether wallet can claim
     * @return reason Reason if cannot claim
     */
    function canClaim(address wallet, uint256 level, uint256 userScore, bytes calldata levelProof) 
        external view returns (bool canClaimResult, string memory reason) 
    {
        if (killSwitch) return (false, "Contract killed");
        if (claimsPaused) return (false, "Claims paused");
        if (block.chainid != BASE_MAINNET_CHAIN_ID) return (false, "Wrong chain");
        if (claimMode == ClaimMode.DISABLED) return (false, "Claims disabled");
        
        PaymentCurrency payoutCurrency = currencyConfig.activeBonusCurrency;
        if (payoutCurrency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) return (false, "ETH disabled");
        if (payoutCurrency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) return (false, "USDC disabled");
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) return (false, "Invalid level");
        
        uint256 bonusAmount = payoutCurrency == PaymentCurrency.ETH ? config.amountETH : config.amountUSDC;
        if (bonusAmount == 0) return (false, "No bonus configured");
        
        uint256 poolBalance = payoutCurrency == PaymentCurrency.ETH ? bonusPoolBalanceETH : bonusPoolBalanceUSDC;
        if (bonusAmount > poolBalance) return (false, "Insufficient pool");
        
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) return (false, "Claim cap reached");
        if (claimMode == ClaimMode.FCFS && config.claimsRemaining == 0) return (false, "Level cap reached");
        
        if ((claimMode == ClaimMode.ONE_TIME || claimMode == ClaimMode.FCFS) && _walletData[wallet].claimedLevels[level]) {
            return (false, "Already claimed");
        }
        
        EligibilityRules memory rules = eligibilityRules;
        
        if (rules.checkLevel) {
            if (levelProof.length == 0) {
                return (true, "Level proof required");
            }
            
            bytes32 levelHash = keccak256(abi.encodePacked(wallet, level, level, address(this), block.chainid));
            bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", levelHash));
            address recovered = _recoverSigner(ethSignedHash, levelProof);
            
            if (recovered != signatureSigner || recovered == address(0)) {
                return (false, "Invalid level proof");
            }
        }
        
        if (rules.checkScore && config.minScore > 0 && userScore < config.minScore) {
            return (false, "Score too low");
        }
        if (rules.checkNFTOwnership && config.requiresNFT && _balances[wallet] == 0) {
            return (false, "NFT required");
        }
        
        return (true, "Eligible");
    }
    
    /**
     * @notice Legacy canClaim for backward compatibility
     * @param wallet Wallet address
     * @param level Bonus level
     * @param userScore User's score
     * @return Whether wallet can claim
     * @return Reason
     */
    function canClaim(address wallet, uint256 level, uint256 userScore) external view returns (bool, string memory) {
        return this.canClaim(wallet, level, userScore, "");
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Internal mint function
     */
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        unchecked { _balances[to]++; }
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
        
        if (_isContract(to) && !_checkOnERC721Received(address(0), to, tokenId, "")) {
            revert TransferToNonReceiver();
        }
    }
    
    /**
     * @dev Internal transfer function
     */
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
    
    /**
     * @dev Internal safe transfer function
     */
    function _safeTransfer(address from, address to, uint256 tokenId, bytes memory data) internal {
        _transfer(from, to, tokenId);
        if (_isContract(to) && !_checkOnERC721Received(from, to, tokenId, data)) {
            revert TransferToNonReceiver();
        }
    }
    
    /**
     * @dev Check if spender is approved or owner
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address tokenOwner = ownerOf(tokenId);
        return spender == tokenOwner || getApproved(tokenId) == spender || isApprovedForAll(tokenOwner, spender);
    }
    
    /**
     * @dev Check if address is contract
     */
    function _isContract(address account) internal view returns (bool) { return account.code.length > 0; }
    
    /**
     * @dev Check ERC721Receiver callback
     */
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) internal returns (bool) {
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            return retval == ERC721_RECEIVER_SELECTOR;
        } catch { return false; }
    }
    
    /**
     * @dev Convert uint256 to string
     */
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
    
    // ============ RECEIVE ETH ============
    
    /**
     * @notice Receive ETH - all deposits go to bonus pool with tracking
     * @dev Non-owner deposits emit UnexpectedETHDeposit for auditing
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
        
        if (msg.sender != _contractOwner) {
            emit UnexpectedETHDeposit(msg.sender, msg.value);
        }
    }
    
    /**
     * @notice Fallback - reject unrecognized calls
     */
    fallback() external payable {
        revert();
    }
}
