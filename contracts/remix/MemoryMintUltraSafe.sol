// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraSafe
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with dual-currency support (ETH/USDC)
 * @dev Optimized for Base Mainnet ONLY, OpenSea, Farcaster, BaseApp, and Coinbase Smart Wallet compatibility
 * @author MemoryMint Team
 * 
 * @dev v4: Security hardening - nonce replay protection, fixed signature expiration
 * 
 * CHANGELOG v4:
 * - FIX #1: Fixed signature expiration validation - signatures must be within [now, now + expirationSeconds] window
 * - FIX #2: Added nonce-based replay protection with per-wallet nonces
 * - FIX #3: Fixed receive() to allow contract integrations with event tracking for unexpected deposits
 * - FIX #4: Added duplicate prevention for activeLevelIds array, removes ALL instances on deactivation
 * - FIX #5: Added zero-amount validations for deposits/withdrawals
 * - FIX #6: Added optional level proof validation to canClaim() view function
 * 
 * BREAKING CHANGES (v4):
 * - mintWithSignature() now requires nonce parameter
 * - mintWithUSDCAndSignature() now requires nonce parameter
 * - Message hash format changed to include nonce
 * - Frontend must call getNonce(wallet) before requesting signatures
 * 
 * PREVIOUS VERSIONS:
 * v3: Dual-currency support (ETH + USDC)
 * v2: Production fixes (tx.origin disabled, level proof, signature expiration)
 * v1: Initial security hardening (CEI pattern, replay protection, denylist priority)
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
error ZeroAmount();                          // v4: Zero amount validation
error InvalidNonce(uint256 expected, uint256 provided);  // v4: Nonce mismatch
error SignatureExpirationTooFar();           // v4: Expiration too far in future

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
    
    // v4: New Events
    event NonceIncremented(address indexed wallet, uint256 newNonce);
    event UnexpectedETHDeposit(address indexed sender, uint256 amount);
    
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
    
    // v4: Nonce-based replay protection
    mapping(address => uint256) private _nonces;
    
    // Signature tracking
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
    
    // ============ MINTING - ETH ============
    
    function mintNFT(string calldata metadataURI) 
        external payable nonReentrant whenNotPaused onlyBaseMainnet returns (uint256) 
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
     * @dev v4: BREAKING CHANGE - Now requires nonce parameter for replay protection
     * @param metadataURI Token metadata URI
     * @param nonce Current nonce for wallet (get via getNonce())
     * @param expiration Signature expiration timestamp
     * @param signature Admin signature
     */
    function mintWithSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external payable nonReentrant whenNotPaused onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.ETH) revert CurrencyNotEnabled();
        if (!currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPriceETH) revert InsufficientPayment(mintPriceETH, msg.value);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    // ============ MINTING - USDC ============
    
    function mintWithUSDC(string calldata metadataURI) 
        external nonReentrant whenNotPaused onlyBaseMainnet returns (uint256) 
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
     * @dev v4: BREAKING CHANGE - Now requires nonce parameter for replay protection
     */
    function mintWithUSDCAndSignature(
        string calldata metadataURI,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) external nonReentrant whenNotPaused onlyBaseMainnet returns (uint256) {
        if (currencyConfig.activeMintCurrency != PaymentCurrency.USDC) revert CurrencyNotEnabled();
        if (!currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        
        if (denylistEnabled && denylist[msg.sender]) revert AddressDenylisted();
        
        _verifyMintSignature(msg.sender, nonce, expiration, signature);
        _performAntiBotChecksForSignedMint(msg.sender);
        _processUSDCPayment(msg.sender, mintPriceUSDC);
        
        return _executeMint(msg.sender, metadataURI);
    }
    
    function _executeMint(address minter, string calldata metadataURI) internal returns (uint256) {
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
        
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
    
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
    
    function _safeUSDCTransfer(address to, uint256 amount) internal {
        (bool callSuccess, bytes memory returnData) = BASE_USDC.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!callSuccess || (returnData.length > 0 && !abi.decode(returnData, (bool)))) {
            revert USDCTransferFailed();
        }
    }
    
    // ============ CLAIM BONUS SYSTEM ============
    
    function claimBonus(uint256 level, uint256 gameLevel, uint256 userScore, bytes calldata levelProof) 
        external nonReentrant onlyBaseMainnet returns (uint256) 
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
     * @notice Verify mint signature with nonce-based replay protection
     * @dev v4: COMPLETE REWRITE with proper expiration and nonce validation
     * 
     * SECURITY NOTES:
     * - Signatures must include wallet-specific nonce to prevent replay attacks
     * - Expiration must be within acceptable window: [now, now + signatureExpirationSeconds]
     * - Message hash includes chainId and contract address to prevent cross-chain/contract replay
     * - Nonce is incremented AFTER successful verification
     * 
     * VALIDATION FLOW:
     * 1. Check nonce matches expected value for wallet
     * 2. Check signature has not already expired (expiration >= now)
     * 3. Check expiration is not too far in future (expiration <= now + maxExpiration)
     * 4. Verify signature recovers to signatureSigner
     * 5. Mark signature as used
     * 6. Increment wallet nonce
     */
    function _verifyMintSignature(
        address wallet,
        uint256 nonce,
        uint256 expiration,
        bytes calldata signature
    ) internal {
        // FIX #1 & #2: Proper nonce and expiration validation
        
        // 1. Validate nonce matches expected value
        uint256 expectedNonce = _nonces[wallet];
        if (nonce != expectedNonce) {
            revert InvalidNonce(expectedNonce, nonce);
        }
        
        // 2. Check if signature has already expired
        if (block.timestamp > expiration) {
            revert SignatureExpired();
        }
        
        // 3. Validate expiration is within allowed window
        // This prevents signatures with expiration far in future from being valid
        // Example with signatureExpirationSeconds = 3600:
        // - Signature created at T with expiration T+30min: VALID (30min < 1hr window)
        // - Signature created at T with expiration T+2hr: INVALID (2hr > 1hr window)
        if (signatureExpirationSeconds > 0) {
            if (expiration > block.timestamp + signatureExpirationSeconds) {
                revert SignatureExpirationTooFar();
            }
        }
        
        // 4. Build message hash WITH NONCE (v4 change)
        bytes32 messageHash = keccak256(
            abi.encodePacked(wallet, nonce, address(this), block.chainid, expiration)
        );
        
        // 5. Check if signature already used (belt-and-suspenders with nonce)
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
    
    // ============ ADMIN: CURRENCY ============
    
    function setETHEnabled(bool enabled) external onlyOwner {
        currencyConfig.ethEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.ETH, enabled);
    }
    
    function setUSDCEnabled(bool enabled) external onlyOwner {
        currencyConfig.usdcEnabled = enabled;
        emit CurrencyEnabledUpdated(PaymentCurrency.USDC, enabled);
    }
    
    function setActiveMintCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeMintCurrency = currency;
        emit ActiveMintCurrencyUpdated(currency);
    }
    
    function setActiveBonusCurrency(PaymentCurrency currency) external onlyOwner {
        if (currency == PaymentCurrency.ETH && !currencyConfig.ethEnabled) revert CurrencyNotEnabled();
        if (currency == PaymentCurrency.USDC && !currencyConfig.usdcEnabled) revert CurrencyNotEnabled();
        currencyConfig.activeBonusCurrency = currency;
        emit ActiveBonusCurrencyUpdated(currency);
    }
    
    // ============ ADMIN: MINTING ============
    
    function setMintPriceETH(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceETH;
        mintPriceETH = newPrice;
        emit MintPriceUpdated(PaymentCurrency.ETH, oldPrice, newPrice);
    }
    
    function setMintPriceUSDC(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPriceUSDC;
        mintPriceUSDC = newPrice;
        emit MintPriceUpdated(PaymentCurrency.USDC, oldPrice, newPrice);
    }
    
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
        if (_totalMinted > 0) emit BatchMetadataUpdate(1, _nextTokenId - 1);
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
    
    function setAntiBotMode(AntiBotMode mode) external onlyOwner {
        antiBotMode = mode;
        if (mode == AntiBotMode.STRICT) txOriginCheck = true;
        else if (mode == AntiBotMode.MODERATE || mode == AntiBotMode.SOFT) txOriginCheck = false;
        emit AntiBotModeUpdated(mode, txOriginCheck);
    }
    
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
    
    function setAllowlistEnabled(bool enabled) external onlyOwner { allowlistEnabled = enabled; }
    function setDenylistEnabled(bool enabled) external onlyOwner { denylistEnabled = enabled; }
    
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
    
    function setSignatureRequired(bool required) external onlyOwner { signatureRequired = required; }
    
    function setSignatureSigner(address signer) external onlyOwner {
        signatureSigner = signer;
        emit SignatureSignerUpdated(signer);
    }
    
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
     * @notice Configure a bonus level
     * @dev v4 FIX #4: Prevents duplicate entries in activeLevelIds
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
            // FIX #4: Check for duplicates before adding
            if (!_isLevelInActiveArray(level)) {
                activeLevelIds.push(level);
            }
        } else if (!active && wasActive) {
            // FIX #4: Remove ALL instances
            _removeAllFromActiveLevels(level);
        }
        
        emit BonusLevelConfigured(level, amountETH, amountUSDC, claimsRemaining);
    }
    
    function deactivateBonusLevel(uint256 level) external onlyOwner {
        bonusLevels[level].active = false;
        _removeAllFromActiveLevels(level);
        emit BonusLevelDeactivated(level);
    }
    
    /**
     * @notice Check if level exists in activeLevelIds
     * @dev v4 FIX #4: Helper for duplicate prevention
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
     * @notice Remove ALL instances of level from activeLevelIds
     * @dev v4 FIX #4: Removes all duplicates, not just first occurrence
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
    
    function setEligibilityRules(bool checkLevel, bool checkScore, bool checkNFTOwnership, bool useAndLogic) external onlyOwner {
        eligibilityRules = EligibilityRules(checkLevel, checkScore, checkNFTOwnership, useAndLogic);
        emit EligibilityRulesUpdated();
    }
    
    /**
     * @notice Deposit ETH to bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function depositBonusFundsETH() external payable onlyOwner {
        if (msg.value == 0) revert ZeroAmount();
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Deposit USDC to bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
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
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function withdrawBonusFundsETH(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceETH) revert InsufficientBonusBalance();
        
        unchecked { bonusPoolBalanceETH -= amount; }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusFundsWithdrawn(amount, PaymentCurrency.ETH);
    }
    
    /**
     * @notice Withdraw USDC from bonus pool
     * @dev v4 FIX #5: Added zero-amount validation
     */
    function withdrawBonusFundsUSDC(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > bonusPoolBalanceUSDC) revert InsufficientBonusBalance();
        
        unchecked { bonusPoolBalanceUSDC -= amount; }
        emit BonusFundsWithdrawn(amount, PaymentCurrency.USDC);
        _safeUSDCTransfer(_contractOwner, amount);
    }
    
    // ============ ADMIN: OWNERSHIP & FUNDS ============
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(_contractOwner, newOwner);
        _contractOwner = newOwner;
    }
    
    function withdrawETH() external onlyOwner nonReentrant {
        uint256 withdrawable = address(this).balance - bonusPoolBalanceETH;
        if (withdrawable == 0) revert WithdrawFailed();
        
        (bool success, ) = payable(_contractOwner).call{value: withdrawable}("");
        if (!success) revert WithdrawFailed();
    }
    
    function withdrawUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 withdrawable = usdc.balanceOf(address(this)) - bonusPoolBalanceUSDC;
        if (withdrawable == 0) revert WithdrawFailed();
        _safeUSDCTransfer(_contractOwner, withdrawable);
    }
    
    function emergencyWithdrawAllETH() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceETH = 0;
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }
    
    function emergencyWithdrawAllUSDC() external onlyOwner nonReentrant {
        IERC20 usdc = IERC20(BASE_USDC);
        uint256 balance = usdc.balanceOf(address(this));
        if (balance == 0) revert WithdrawFailed();
        bonusPoolBalanceUSDC = 0;
        _safeUSDCTransfer(_contractOwner, balance);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function totalSupply() external view returns (uint256) { return _totalMinted; }
    function nextTokenId() external view returns (uint256) { return _nextTokenId; }
    function exists(uint256 tokenId) external view returns (bool) { return _owners[tokenId] != address(0); }
    function owner() external view returns (address) { return _contractOwner; }
    function baseURI() external view returns (string memory) { return _baseTokenURI; }
    
    /**
     * @notice Get current nonce for wallet
     * @dev v4: Frontend must call this before requesting signatures
     */
    function getNonce(address wallet) external view returns (uint256) {
        return _nonces[wallet];
    }
    
    function getWalletMintCount(address wallet) external view returns (uint256) { return _walletData[wallet].mintCount; }
    function getWalletLastMintBlock(address wallet) external view returns (uint256) { return _walletData[wallet].lastMintBlock; }
    function hasClaimedLevel(address wallet, uint256 level) external view returns (bool) { return _walletData[wallet].claimedLevels[level]; }
    function getTotalClaimedETH(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedETH; }
    function getTotalClaimedUSDC(address wallet) external view returns (uint256) { return _walletData[wallet].totalClaimedUSDC; }
    function getActiveLevelIds() external view returns (uint256[] memory) { return activeLevelIds; }
    
    function getCurrentMintPrice() external view returns (uint256 price, PaymentCurrency currency) {
        currency = currencyConfig.activeMintCurrency;
        price = currency == PaymentCurrency.ETH ? mintPriceETH : mintPriceUSDC;
    }
    
    function getBonusLevelConfig(uint256 level) external view returns (
        uint256 amountETH, uint256 amountUSDC, bool active, uint256 claimsRemaining, uint256 minScore, bool requiresNFT
    ) {
        BonusConfig storage config = bonusLevels[level];
        return (config.amountETH, config.amountUSDC, config.active, config.claimsRemaining, config.minScore, config.requiresNFT);
    }
    
    function getUSDCAddress() external pure returns (address) { return BASE_USDC; }
    function isBaseMainnet() external view returns (bool) { return block.chainid == BASE_MAINNET_CHAIN_ID; }
    
    function canMint(address wallet) external view returns (bool canMintResult, string memory reason) {
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
     * @dev v4 FIX #6: Added optional levelProof parameter for validation
     * @param wallet Address to check
     * @param level Bonus level
     * @param userScore User's score
     * @param levelProof Optional level proof (pass empty bytes if not available)
     */
    function canClaim(address wallet, uint256 level, uint256 userScore, bytes calldata levelProof) 
        external view returns (bool canClaimResult, string memory reason) 
    {
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
        
        // FIX #6: Validate level proof if provided and required
        if (rules.checkLevel) {
            if (levelProof.length == 0) {
                return (true, "Level proof required");
            }
            
            // Validate the proof
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
    
    // Legacy canClaim for backward compatibility
    function canClaim(address wallet, uint256 level, uint256 userScore) external view returns (bool, string memory) {
        return this.canClaim(wallet, level, userScore, "");
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
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
    
    function _isContract(address account) internal view returns (bool) { return account.code.length > 0; }
    
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
    
    // ============ RECEIVE ETH ============
    
    /**
     * @notice Receive ETH - all deposits go to bonus pool with tracking
     * @dev v4 FIX #3: Removed owner restriction, tracks unexpected deposits via event
     * 
     * This allows:
     * - Smart contracts to send ETH to this contract
     * - Multi-sig wallets to fund the bonus pool
     * - Contract integrations to work properly
     * 
     * Non-owner deposits emit UnexpectedETHDeposit for auditing
     */
    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        
        bonusPoolBalanceETH += msg.value;
        emit BonusFundsDeposited(msg.value, PaymentCurrency.ETH);
        
        // Track non-owner deposits for auditing
        if (msg.sender != _contractOwner) {
            emit UnexpectedETHDeposit(msg.sender, msg.value);
        }
    }
    
    fallback() external payable {
        revert(); // Reject unrecognized calls
    }
}
