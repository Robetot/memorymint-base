// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
