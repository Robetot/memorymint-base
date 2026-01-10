// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║               MEMORYMINT ULTRA V2 - PART 1: INTERFACES                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 1 of 8
 * This file contains all interface definitions required by the contract.
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

// ============ Interfaces (Minimal, Standards-Compliant) ============
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

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

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
