// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintUltraSafe
 * @notice Ultra-safe, anti-bot, production-grade ERC-721 NFT contract with configurable claim bonus system
 * @dev Optimized for Base Mainnet, OpenSea, Farcaster, and BaseApp compatibility
 * @author MemoryMint Team
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
error FCFSCapReached(uint256 cap);
error BotDetected();
error ReentrancyGuard();
error ClaimNotActive();
error AlreadyClaimed();
error NotEligible();
error InvalidBonusLevel();
error InsufficientBonusBalance();
error ClaimCapReached();

// ============ MAIN CONTRACT ============

contract MemoryMintUltraSafe {
    
    // ============ EVENTS ============
    
    // ERC-721 Events
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // Admin Events
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event MintingPausedUpdated(bool paused);
    event EmergencyMintDisabledUpdated(bool disabled);
    
    // Anti-Bot Events
    event WalletMintLimitUpdated(uint256 limit);
    event MintCooldownUpdated(uint256 blocks);
    event AllowlistUpdated(address indexed wallet, bool status);
    event DenylistUpdated(address indexed wallet, bool status);
    event AntiBotModeUpdated(uint8 mode);
    
    // Claim Bonus Events
    event BonusLevelConfigured(uint256 indexed level, uint256 amount);
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
        SOFT,              // 1: Basic checks only
        MODERATE,          // 2: Standard protections
        STRICT,            // 3: Maximum protection
        CUSTOM             // 4: Custom configuration
    }
    
    // ============ STRUCTS ============
    
    struct BonusConfig {
        uint256 amount;           // Bonus amount in wei
        bool active;              // Is this level active
        uint256 claimsRemaining;  // For FCFS mode (0 = unlimited)
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
        bool checkLevel;          // Check level requirement
        bool checkScore;          // Check score requirement
        bool checkNFTOwnership;   // Check NFT ownership
        bool useAndLogic;         // true = AND, false = OR
    }
    
    // ============ CONSTANTS ============
    
    bytes4 private constant ERC721_RECEIVER_SELECTOR = 0x150b7a02;
    bytes4 private constant INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC721_METADATA = 0x5b5e139f;
    
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
    bool public txOriginCheck;
    
    mapping(address => bool) public allowlist;
    mapping(address => bool) public denylist;
    mapping(address => WalletData) private _walletData;
    mapping(bytes32 => bool) private _usedSignatures;
    address public signatureSigner;
    
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
    
    modifier antiBotChecks() {
        _performAntiBotChecks();
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
        
        // Default anti-bot settings (moderate protection)
        antiBotMode = AntiBotMode.MODERATE;
        walletMintLimit = 10;
        mintCooldownBlocks = 1;
        txOriginCheck = true;
        
        // Default claim settings
        claimMode = ClaimMode.DISABLED;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============ ERC-165 ============
    
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return
            interfaceId == INTERFACE_ID_ERC165 ||
            interfaceId == INTERFACE_ID_ERC721 ||
            interfaceId == INTERFACE_ID_ERC721_METADATA;
    }
    
    // ============ ERC-721 METADATA ============
    
    function name() public view returns (string memory) {
        return _name;
    }
    
    function symbol() public view returns (string memory) {
        return _symbol;
    }
    
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) {
            return customURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }
    
    // ============ ERC-721 CORE ============
    
    function balanceOf(address owner) public view returns (uint256) {
        if (owner == address(0)) revert ZeroAddress();
        return _balances[owner];
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        if (owner == address(0)) revert TokenNotExist(tokenId);
        return owner;
    }
    
    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        if (to == owner) revert SelfApproval();
        if (msg.sender != owner && !isApprovedForAll(owner, msg.sender)) {
            revert NotApproved();
        }
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }
    
    function getApproved(uint256 tokenId) public view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist(tokenId);
        return _tokenApprovals[tokenId];
    }
    
    function setApprovalForAll(address operator, bool approved) public {
        if (operator == msg.sender) revert SelfApproval();
        if (operator == address(0)) revert ZeroAddress();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }
    
    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }
    
    function transferFrom(address from, address to, uint256 tokenId) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _transfer(from, to, tokenId);
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }
    
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        if (!_isApprovedOrOwner(msg.sender, tokenId)) revert NotApproved();
        _safeTransfer(from, to, tokenId, data);
    }
    
    // ============ MINTING ============
    
    function mintNFT(string calldata metadataURI) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        antiBotChecks 
        returns (uint256) 
    {
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }
        
        // FCFS cap check
        if (fcfsMintCap > 0 && _totalMinted >= fcfsMintCap) {
            revert FCFSCapReached(fcfsMintCap);
        }
        
        uint256 tokenId = _nextTokenId++;
        _totalMinted++;
        
        // Update wallet data
        WalletData storage walletData = _walletData[msg.sender];
        walletData.mintCount++;
        walletData.lastMintBlock = block.number;
        
        // Mint
        _mint(msg.sender, tokenId);
        
        // Set custom URI if provided
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
        }
        
        return tokenId;
    }
    
    function mintWithSignature(
        string calldata metadataURI,
        bytes32 messageHash,
        bytes calldata signature
    ) 
        external 
        payable 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        if (!signatureRequired) revert InvalidSignature();
        if (_usedSignatures[messageHash]) revert InvalidSignature();
        if (!_verifySignature(messageHash, signature)) revert InvalidSignature();
        
        _usedSignatures[messageHash] = true;
        
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }
        
        uint256 tokenId = _nextTokenId++;
        _totalMinted++;
        
        WalletData storage walletData = _walletData[msg.sender];
        walletData.mintCount++;
        walletData.lastMintBlock = block.number;
        
        _mint(msg.sender, tokenId);
        
        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
        }
        
        return tokenId;
    }
    
    // ============ CLAIM BONUS SYSTEM ============
    
    function claimBonus(uint256 level, uint256 userScore) 
        external 
        nonReentrant 
        returns (uint256) 
    {
        if (claimMode == ClaimMode.DISABLED) revert ClaimNotActive();
        
        BonusConfig storage config = bonusLevels[level];
        if (!config.active) revert InvalidBonusLevel();
        if (config.amount == 0) revert InvalidBonusLevel();
        if (config.amount > bonusPoolBalance) revert InsufficientBonusBalance();
        
        // Check claim cap
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) {
            revert ClaimCapReached();
        }
        
        // Check FCFS remaining
        if (claimMode == ClaimMode.FCFS && config.claimsRemaining == 0) {
            revert ClaimCapReached();
        }
        
        WalletData storage walletData = _walletData[msg.sender];
        
        // Check one-time claim
        if (claimMode == ClaimMode.ONE_TIME && walletData.claimedLevels[level]) {
            revert AlreadyClaimed();
        }
        
        // Check eligibility
        if (!_checkEligibility(msg.sender, level, userScore)) {
            revert NotEligible();
        }
        
        // Update state before transfer (CEI pattern)
        uint256 amount = config.amount;
        bonusPoolBalance -= amount;
        totalClaimsMade++;
        walletData.claimedLevels[level] = true;
        walletData.totalClaimed += amount;
        
        if (claimMode == ClaimMode.FCFS && config.claimsRemaining > 0) {
            config.claimsRemaining--;
        }
        
        // Transfer bonus
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert WithdrawFailed();
        
        emit BonusClaimed(msg.sender, level, amount);
        
        return amount;
    }
    
    function _checkEligibility(
        address wallet,
        uint256 level,
        uint256 userScore
    ) internal view returns (bool) {
        BonusConfig storage config = bonusLevels[level];
        
        bool levelCheck = true;
        bool scoreCheck = true;
        bool nftCheck = true;
        
        if (eligibilityRules.checkScore && config.minScore > 0) {
            scoreCheck = userScore >= config.minScore;
        }
        
        if (eligibilityRules.checkNFTOwnership && config.requiresNFT) {
            nftCheck = _balances[wallet] > 0;
        }
        
        if (eligibilityRules.useAndLogic) {
            return levelCheck && scoreCheck && nftCheck;
        } else {
            return levelCheck || scoreCheck || nftCheck;
        }
    }
    
    // ============ ANTI-BOT INTERNAL ============
    
    function _performAntiBotChecks() internal view {
        if (antiBotMode == AntiBotMode.DISABLED) return;
        
        WalletData storage walletData = _walletData[msg.sender];
        
        // Denylist check (always active if enabled)
        if (denylistEnabled && denylist[msg.sender]) {
            revert AddressDenylisted();
        }
        
        // Allowlist check
        if (allowlistEnabled && !allowlist[msg.sender]) {
            revert NotAllowlisted();
        }
        
        // Tx.origin check (detect contract calls)
        if (txOriginCheck && tx.origin != msg.sender) {
            revert BotDetected();
        }
        
        // Wallet mint limit
        if (walletMintLimit > 0 && walletData.mintCount >= walletMintLimit) {
            revert WalletMintLimitExceeded(walletMintLimit);
        }
        
        // Cooldown check
        if (mintCooldownBlocks > 0 && walletData.lastMintBlock > 0) {
            uint256 blocksSinceLastMint = block.number - walletData.lastMintBlock;
            if (blocksSinceLastMint < mintCooldownBlocks) {
                revert MintCooldownActive(mintCooldownBlocks - blocksSinceLastMint);
            }
        }
    }
    
    function _verifySignature(
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bool) {
        if (signatureSigner == address(0)) return false;
        if (signature.length != 65) return false;
        
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        
        if (v < 27) v += 27;
        
        return ecrecover(ethSignedHash, v, r, s) == signatureSigner;
    }
    
    // ============ ADMIN: MINTING ============
    
    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }
    
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
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
        emit AntiBotModeUpdated(uint8(mode));
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
    }
    
    function setTxOriginCheck(bool enabled) external onlyOwner {
        txOriginCheck = enabled;
    }
    
    function setAllowlistEnabled(bool enabled) external onlyOwner {
        allowlistEnabled = enabled;
    }
    
    function setDenylistEnabled(bool enabled) external onlyOwner {
        denylistEnabled = enabled;
    }
    
    function updateAllowlist(address[] calldata wallets, bool status) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            allowlist[wallets[i]] = status;
            emit AllowlistUpdated(wallets[i], status);
        }
    }
    
    function updateDenylist(address[] calldata wallets, bool status) external onlyOwner {
        for (uint256 i = 0; i < wallets.length; i++) {
            denylist[wallets[i]] = status;
            emit DenylistUpdated(wallets[i], status);
        }
    }
    
    function setSignatureRequired(bool required) external onlyOwner {
        signatureRequired = required;
    }
    
    function setSignatureSigner(address signer) external onlyOwner {
        signatureSigner = signer;
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
    
    function configureBonusLevel(
        uint256 level,
        uint256 amount,
        bool active,
        uint256 claimsRemaining,
        uint256 minScore,
        bool requiresNFT
    ) external onlyOwner {
        bonusLevels[level] = BonusConfig({
            amount: amount,
            active: active,
            claimsRemaining: claimsRemaining,
            minScore: minScore,
            requiresNFT: requiresNFT
        });
        
        // Track active levels
        bool found = false;
        for (uint256 i = 0; i < activeLevelIds.length; i++) {
            if (activeLevelIds[i] == level) {
                found = true;
                break;
            }
        }
        if (!found && active) {
            activeLevelIds.push(level);
        }
        
        emit BonusLevelConfigured(level, amount);
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
        if (amount > bonusPoolBalance) revert InsufficientBonusBalance();
        bonusPoolBalance -= amount;
        
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
        uint256 balance = address(this).balance - bonusPoolBalance;
        if (balance == 0) revert WithdrawFailed();
        
        (bool success, ) = payable(_contractOwner).call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function totalSupply() public view returns (uint256) {
        return _totalMinted;
    }
    
    function nextTokenId() public view returns (uint256) {
        return _nextTokenId;
    }
    
    function exists(uint256 tokenId) public view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    function owner() public view returns (address) {
        return _contractOwner;
    }
    
    function baseURI() public view returns (string memory) {
        return _baseTokenURI;
    }
    
    function getWalletMintCount(address wallet) public view returns (uint256) {
        return _walletData[wallet].mintCount;
    }
    
    function getWalletLastMintBlock(address wallet) public view returns (uint256) {
        return _walletData[wallet].lastMintBlock;
    }
    
    function hasClaimedLevel(address wallet, uint256 level) public view returns (bool) {
        return _walletData[wallet].claimedLevels[level];
    }
    
    function getTotalClaimed(address wallet) public view returns (uint256) {
        return _walletData[wallet].totalClaimed;
    }
    
    function getActiveLevelIds() public view returns (uint256[] memory) {
        return activeLevelIds;
    }
    
    function canMint(address wallet) public view returns (bool, string memory) {
        if (mintingPaused) return (false, "Minting is paused");
        if (emergencyMintDisabled) return (false, "Emergency: minting disabled");
        if (denylistEnabled && denylist[wallet]) return (false, "Address is denylisted");
        if (allowlistEnabled && !allowlist[wallet]) return (false, "Address not allowlisted");
        if (walletMintLimit > 0 && _walletData[wallet].mintCount >= walletMintLimit) {
            return (false, "Wallet mint limit reached");
        }
        if (mintCooldownBlocks > 0 && _walletData[wallet].lastMintBlock > 0) {
            uint256 blocksSince = block.number - _walletData[wallet].lastMintBlock;
            if (blocksSince < mintCooldownBlocks) {
                return (false, "Mint cooldown active");
            }
        }
        if (fcfsMintCap > 0 && _totalMinted >= fcfsMintCap) {
            return (false, "FCFS mint cap reached");
        }
        return (true, "Eligible to mint");
    }
    
    function canClaim(address wallet, uint256 level, uint256 userScore) public view returns (bool, string memory) {
        if (claimMode == ClaimMode.DISABLED) return (false, "Claims are disabled");
        if (!bonusLevels[level].active) return (false, "Invalid bonus level");
        if (bonusLevels[level].amount == 0) return (false, "No bonus configured for level");
        if (bonusLevels[level].amount > bonusPoolBalance) return (false, "Insufficient bonus pool");
        if (totalClaimCap > 0 && totalClaimsMade >= totalClaimCap) return (false, "Total claim cap reached");
        if (claimMode == ClaimMode.FCFS && bonusLevels[level].claimsRemaining == 0) {
            return (false, "Level claim cap reached");
        }
        if (claimMode == ClaimMode.ONE_TIME && _walletData[wallet].claimedLevels[level]) {
            return (false, "Already claimed this level");
        }
        if (!_checkEligibility(wallet, level, userScore)) {
            return (false, "Not eligible");
        }
        return (true, "Eligible to claim");
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _mint(address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
        
        // Safe mint check
        if (_isContract(to)) {
            if (!_checkOnERC721Received(address(0), to, tokenId, "")) {
                revert TransferToNonReceiver();
            }
        }
    }
    
    function _transfer(address from, address to, uint256 tokenId) internal {
        if (to == address(0)) revert ZeroAddress();
        if (ownerOf(tokenId) != from) revert NotTokenOwner();
        
        // Clear approvals
        delete _tokenApprovals[tokenId];
        
        _balances[from]--;
        _balances[to]++;
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
        } catch {
            return false;
        }
    }
    
    function _toString(uint256 value) internal pure returns (string memory) {
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
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }
    
    // ============ RECEIVE ETH ============
    
    receive() external payable {}
}
