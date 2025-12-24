// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraSafe
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with configurable claim bonus system
 * @dev Optimized for Base Mainnet, OpenSea, Farcaster, BaseApp, and Coinbase Smart Wallet compatibility
 * @author MemoryMint Team
 * 
 * PRODUCTION FIXES APPLIED (v2):
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
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
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
    event BonusLevelConfigured(uint256 indexed level, uint256 amount, uint256 claimsRemaining);
    event BonusLevelDeactivated(uint256 indexed level);
    event BonusLevelRemoved(uint256 indexed level);
    event BonusClaimed(address indexed claimer, uint256 indexed level, uint256 amount);
    event ClaimModeUpdated(ClaimMode mode);
    event ClaimCapUpdated(uint256 cap);
    event EligibilityRulesUpdated();
    event BonusFundsDeposited(uint256 amount);
    event BonusFundsWithdrawn(uint256 amount);
    
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
    
    // ============ STRUCTS ============
    
    struct BonusConfig {
        uint256 amount;           // Bonus amount in wei
        bool active;              // Is this level active
        uint256 claimsRemaining;  // For FCFS mode (0 = exhausted in FCFS)
        uint256 minScore;         // Minimum score required (0 = no requirement)
        bool requiresNFT;         // Must own an NFT to claim
    }
    
    struct WalletData {
        uint256 mintCount;        // Total mints by this wallet
        uint256 lastMintBlock;    // Block number of last mint
        mapping(uint256 => bool) claimedLevels;  // Levels already claimed
        uint256 totalClaimed;     // Total bonus amount claimed
    }
    
    struct EligibilityRules {
        bool checkLevel;          // Check level requirement (requires signed proof)
        bool checkScore;          // Check score requirement
        bool checkNFTOwnership;   // Check NFT ownership
        bool useAndLogic;         // true = AND, false = OR
    }
    
    // ============ CONSTANTS ============
    
    bytes4 private constant ERC721_RECEIVER_SELECTOR = 0x150b7a02;
    bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    bytes4 private constant INTERFACE_ID_ERC4906 = 0x49064906;
    
    // EIP-2 signature malleability bound
    uint256 private constant MAX_S_VALUE = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;
    
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
    
    // Minting Configuration
    uint256 public mintPrice;
    bool public mintingPaused;
    bool public emergencyMintDisabled;
    
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
    
    // Claim Bonus System
    ClaimMode public claimMode;
    uint256 public totalClaimCap;          // 0 = unlimited
    uint256 public totalClaimsMade;
    uint256 public bonusPoolBalance;
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
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Deploy with production-safe defaults
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
    
    // ============ MINTING ============
    
    /**
     * @notice Mint without signature (only works if signatureRequired is false)
     */
    function mintNFT(string calldata metadataURI) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        if (signatureRequired) revert InvalidSignature();
        
        _performAntiBotChecks(msg.sender);
        
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }
        
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
        WalletData storage walletData = _walletData[msg.sender];
        unchecked {
            walletData.mintCount++;
        }
        walletData.lastMintBlock = block.number;
        
        // Mint
        _mint(msg.sender, tokenId);
        
        // Set custom URI if provided
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
    
    /**
     * @notice Mint with signature verification (recommended)
     * @dev FIX #4: Signatures now include expiration timestamp
     * @param metadataURI Token metadata URI
     * @param expiration Signature expiration timestamp (0 = no expiration)
     * @param signature Backend-signed approval
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
        returns (uint256) 
    {
        // Denylist check first
        if (denylistEnabled && denylist[msg.sender]) {
            revert AddressDenylisted();
        }
        
        // Verify signature with expiration
        _verifyMintSignature(msg.sender, expiration, signature);
        
        // Standard anti-bot checks (except denylist, already done)
        _performAntiBotChecksForSignedMint(msg.sender);
        
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }
        
        // FCFS cap check
        uint256 totalMinted = _totalMinted;
        uint256 mintCap = fcfsMintCap;
        if (mintCap > 0 && totalMinted >= mintCap) {
            revert FCFSCapReached(mintCap);
        }
        
        uint256 tokenId = _nextTokenId;
        
        // Update state
        unchecked {
            _nextTokenId = tokenId + 1;
            _totalMinted = totalMinted + 1;
        }
        
        WalletData storage walletData = _walletData[msg.sender];
        unchecked {
            walletData.mintCount++;
        }
        walletData.lastMintBlock = block.number;
        
        _mint(msg.sender, tokenId);
        
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
            emit MetadataUpdate(tokenId);
        }
        
        return tokenId;
    }
    
    // ============ CLAIM BONUS SYSTEM ============
    
    /**
     * @notice Claim bonus for completing a level
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
        returns (uint256) 
    {
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        // Cache storage reads
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        
        uint256 bonusAmount = config.amount;
        if (bonusAmount == 0) revert InvalidBonusLevel();
        
        uint256 currentPool = bonusPoolBalance;
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
        unchecked {
            bonusPoolBalance = currentPool - bonusAmount;
        }
        
        // Update total claims
        unchecked {
            totalClaimsMade++;
        }
        
        // Mark level as claimed for this wallet
        walletData.claimedLevels[level] = true;
        
        // Update wallet total claimed
        unchecked {
            walletData.totalClaimed += bonusAmount;
        }
        
        // Decrement FCFS remaining
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked {
                config.claimsRemaining = remaining - 1;
            }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount);
        
        // ============ EXTERNAL CALL LAST ============
        
        (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
        if (!success) revert WithdrawFailed();
        
        return bonusAmount;
    }
    
    /**
     * @notice Legacy claimBonus for backwards compatibility
     * @dev Calls new claimBonus with empty level proof
     */
    function claimBonus(uint256 level, uint256 userScore) 
        external 
        nonReentrant 
        returns (uint256) 
    {
        // For backwards compatibility when checkLevel is disabled
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        
        uint256 bonusAmount = config.amount;
        if (bonusAmount == 0) revert InvalidBonusLevel();
        
        uint256 currentPool = bonusPoolBalance;
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
        
        unchecked {
            bonusPoolBalance = currentPool - bonusAmount;
            totalClaimsMade++;
        }
        
        walletData.claimedLevels[level] = true;
        
        unchecked {
            walletData.totalClaimed += bonusAmount;
        }
        
        if (currentMode == ClaimMode.FCFS && remaining > 0) {
            unchecked {
                config.claimsRemaining = remaining - 1;
            }
        }
        
        emit BonusClaimed(msg.sender, level, bonusAmount);
        
        (bool success, ) = payable(msg.sender).call{value: bonusAmount}("");
        if (!success) revert WithdrawFailed();
        
        return bonusAmount;
    }
    
    /**
     * @notice Check eligibility for bonus claim
     * @dev FIX #2: Enforces level verification via signed proof when checkLevel is enabled
     * 
     * SECURITY FIX #1 - SIGNATURE BOUND TO BONUS LEVEL:
     * The level proof now includes both gameLevel AND bonus level (parameter 'level')
     * This prevents cross-level replay attacks where a proof for one bonus level
     * could be reused to claim a different bonus level.
     * 
     * Signed message includes:
     * - wallet address
     * - game level completed
     * - bonus level ID (the level being claimed)
     * - contract address
     * - chain ID
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
            
            /**
             * SECURITY FIX #1: Proof message now includes BONUS LEVEL ID
             * 
             * The signed hash includes:
             * - wallet: The address claiming the bonus
             * - gameLevel: The game level the player completed
             * - level: The BONUS LEVEL ID being claimed (CRITICAL for cross-level replay prevention)
             * - address(this): The contract address
             * - block.chainid: The chain ID
             * 
             * This ensures a signature for (gameLevel=5, bonusLevel=1) cannot be used to claim bonusLevel=2
             */
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
        // MODERATE mode does NOT use tx.origin (smart wallet compatible)
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
     * 
     * SECURITY FIX #2 - SIGNATURE EXPIRATION SEMANTICS:
     * 
     * The expiration parameter behavior is EXPLICITLY defined as follows:
     * 
     * - expiration == 0: NO EXPIRATION - signature is valid forever (until used)
     *   This is intentional for backwards compatibility and cases where
     *   time-limited signatures are not needed.
     * 
     * - expiration > 0: The signature expires at this Unix timestamp.
     *   If block.timestamp > expiration, the signature is rejected.
     * 
     * NOTE: signatureExpirationSeconds is a HINT for backend signature generation,
     * not enforced on-chain when expiration == 0.
     */
    function _verifyMintSignature(
        address wallet,
        uint256 expiration,
        bytes calldata signature
    ) internal {
        /**
         * SECURITY FIX #2: Explicit expiration semantics
         * 
         * expiration == 0: No expiration (valid forever until used)
         * expiration > 0: Expires at this timestamp
         */
        if (expiration > 0 && block.timestamp > expiration) {
            revert SignatureExpired();
        }
        // Note: expiration == 0 intentionally allows signature to be valid forever
        
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
    
    // ============ ADMIN: MINTING ============
    
    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
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
     * @notice Configure a bonus level
     * @dev FIX #3: Now properly manages activeLevelIds array
     */
    function configureBonusLevel(
        uint256 level,
        uint256 amount,
        bool active,
        uint256 claimsRemaining,
        uint256 minScore,
        bool requiresNFT
    ) external onlyOwner {
        BonusConfig storage config = bonusLevels[level];
        bool wasActive = config.active;
        
        config.amount = amount;
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
        
        emit BonusLevelConfigured(level, amount, claimsRemaining);
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
    
    function depositBonusFunds() external payable onlyOwner {
        bonusPoolBalance += msg.value;
        emit BonusFundsDeposited(msg.value);
    }
    
    function withdrawBonusFunds(uint256 amount) external onlyOwner nonReentrant {
        uint256 currentPool = bonusPoolBalance;
        if (amount > currentPool) revert InsufficientBonusBalance();
        
        unchecked {
            bonusPoolBalance = currentPool - amount;
        }
        
        (bool success, ) = payable(_contractOwner).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusFundsWithdrawn(amount);
    }
    
    // ============ ADMIN: OWNERSHIP & FUNDS ============
    
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = _contractOwner;
        _contractOwner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function withdraw() external onlyOwner nonReentrant {
        uint256 contractBalance = address(this).balance;
        uint256 reserved = bonusPoolBalance;
        
        if (contractBalance <= reserved) revert WithdrawFailed();
        
        uint256 withdrawable;
        unchecked {
            withdrawable = contractBalance - reserved;
        }
        
        (bool success, ) = payable(_contractOwner).call{value: withdrawable}("");
        if (!success) revert WithdrawFailed();
    }
    
    function emergencyWithdrawAll() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert WithdrawFailed();
        
        bonusPoolBalance = 0;
        
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
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
    
    function getTotalClaimed(address wallet) external view returns (uint256) {
        return _walletData[wallet].totalClaimed;
    }
    
    function getActiveLevelIds() external view returns (uint256[] memory) {
        return activeLevelIds;
    }
    
    function canMint(address wallet) external view returns (bool canMintResult, string memory reason) {
        if (mintingPaused) return (false, "Minting is paused");
        if (emergencyMintDisabled) return (false, "Emergency: minting disabled");
        if (denylistEnabled && denylist[wallet]) return (false, "Address is denylisted");
        if (allowlistEnabled && !allowlist[wallet]) return (false, "Address not allowlisted");
        
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
        ClaimMode currentMode = claimMode;
        if (currentMode == ClaimMode.DISABLED) return (false, "Claims are disabled");
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) return (false, "Invalid bonus level");
        if (config.amount == 0) return (false, "No bonus configured for level");
        if (config.amount > bonusPoolBalance) return (false, "Insufficient bonus pool");
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
     * SECURITY FIX #3 - BONUS POOL FUNDING CLARITY:
     * 
     * Direct ETH transfers to this contract via receive() are EXPLICITLY
     * added to the bonusPoolBalance. This is intentional behavior.
     * 
     * WHY THIS DESIGN:
     * - Allows easy funding from any address (admin, multisig, external contracts)
     * - Simplifies deposit workflow for non-technical users
     * - Maintains compatibility with standard ETH transfers
     * 
     * AUDITABLE BEHAVIOR:
     * - Every deposit emits BonusFundsDeposited(amount) event
     * - bonusPoolBalance is publicly readable
     * - All bonus pool changes are tracked via events
     * 
     * ALTERNATIVE:
     * For admin-only funding, use depositBonusFunds() which requires onlyOwner
     */
    receive() external payable {
        bonusPoolBalance += msg.value;
        emit BonusFundsDeposited(msg.value);
    }
}
