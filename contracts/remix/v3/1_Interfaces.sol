// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMint Ultra V3 - Interfaces & Custom Errors
 * @notice Part 1/8 - Foundation interfaces and error definitions
 * @dev Deploy order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM ERRORS (Gas-efficient error handling)
// ═══════════════════════════════════════════════════════════════════════════════

error Unauthorized();
error InvalidAddress();
error InvalidAmount();
error InvalidTokenId();
error InvalidSignature();
error InvalidNonce();
error ExpiredSignature();
error SignatureExpirationTooShort();
error InsufficientPayment();
error InsufficientBalance();
error InsufficientContractBalance();
error MintPaused();
error ClaimsPaused();
error TransferFailed();
error TokenNotFound();
error AlreadyClaimed();
error NotEligible();
error ClaimCooldownActive();
error WalletLimitExceeded();
error MintCooldownActive();
error CurrencyNotEnabled();
error USDCNotEnabled();
error NoBonusAvailable();
error BonusCapExceeded();
error ReentrancyGuard();
error KillSwitchActive();
error PriceExceedsMaximum();
error BatchSizeExceeded();
error InvalidLevel();
error InvalidTier();
error TierLimitExceeded();
error DynamicPricingDisabled();
error DynamicBonusDisabled();

// ═══════════════════════════════════════════════════════════════════════════════
// ERC STANDARD INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @dev ERC-165 Standard Interface Detection
 */
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @dev ERC-721 Non-Fungible Token Standard
 */
interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}

/**
 * @dev ERC-721 Metadata Extension
 */
interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}

/**
 * @dev ERC-721 Token Receiver Interface
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
 * @dev ERC-20 Interface for USDC payments
 */
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * @dev Chainlink Price Feed Interface
 */
interface IChainlinkAggregator {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}
