// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                 MEMORYMINT ULTRA V2 - PART 2: EVENTS                      ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Deploy Order: 2 of 8
 * This file contains all event definitions.
 */

import "./1_Interfaces.sol";

/**
 * @title MemoryMintEvents
 * @notice All events used by the MemoryMint contract
 */
abstract contract MemoryMintEvents {
    // ERC-4906 Metadata Update Events
    event MetadataUpdate(uint256 indexed tokenId);
    event BatchMetadataUpdate(uint256 indexed fromTokenId, uint256 indexed toTokenId);
    
    // Core Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint8 level, uint8 rarity);
    event BatchMinted(address indexed to, uint256 startTokenId, uint256 quantity);
    event PlayerRegistered(address indexed player, string name, uint64 farcasterFid);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    event TokenMetadataFrozen(uint256 indexed tokenId);
    event ThrottleUpdated(bool enabled);
    
    // V2 Admin Events
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
    event MintFeesWithdrawn(address indexed to, uint256 ethAmount, uint256 usdcAmount);
}
