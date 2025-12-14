// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintFarcaster - Production ERC-721 for Memory Flip Game
 * @author MemoryMint Team
 * @notice Base Mainnet optimized NFT with Farcaster integration
 * @dev Minimal gas, ERC4906 MetadataUpdate events, Remix-compatible imports
 * 
 * Features:
 * - Public mintNFT(string tokenURI) for anyone to mint
 * - Auto-increment token IDs (safe, unchecked math)
 * - adminBurn restricted to contract owner
 * - IERC4906 MetadataUpdate event emission
 * - ERC721URIStorage pattern for per-token metadata
 * - ~45k gas per mint on Base Mainnet
 * 
 * Compile: Solidity 0.8.20, Optimizer 200 runs, EVM: paris
 */

// OpenZeppelin v4.9.3 via jsDelivr CDN (Remix compatible)
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.3/contracts/token/ERC721/ERC721.sol";
import "https://cdn.jsdelivr.net/npm/@openzeppelin/contracts@4.9.3/contracts/access/Ownable.sol";

/// @dev IERC4906 interface for metadata updates (EIP-4906)
interface IERC4906 {
    /// @notice Emitted when the metadata of a token is changed
    event MetadataUpdate(uint256 _tokenId);
    
    /// @notice Emitted when the metadata of a range of tokens is changed
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
}

/**
 * @title MemoryMintFarcaster
 * @notice Production NFT contract for Memory Flip Game on Base Mainnet
 */
contract MemoryMintFarcaster is ERC721, Ownable, IERC4906 {

    // ============ Storage ============
    
    /// @dev Next token ID to mint (starts at 1)
    uint256 private _nextTokenId;
    
    /// @dev Mapping from token ID to token URI
    mapping(uint256 => string) private _tokenURIs;
    
    // ============ Events ============
    
    /// @notice Emitted when a new NFT is minted
    event NFTMinted(
        address indexed to,
        uint256 indexed tokenId,
        string tokenURI
    );
    
    /// @notice Emitted when a token is burned by admin
    event NFTBurned(
        address indexed owner,
        uint256 indexed tokenId
    );

    // ============ Constructor ============
    
    /**
     * @notice Deploy the MemoryMintFarcaster contract
     * @param name_ Token collection name
     * @param symbol_ Token collection symbol
     */
    constructor(
        string memory name_,
        string memory symbol_
    ) ERC721(name_, symbol_) {
        _nextTokenId = 1; // Start token IDs at 1
    }

    // ============ Public Minting ============
    
    /**
     * @notice Mint a new NFT to the caller with custom tokenURI
     * @param tokenURI_ The metadata URI for this token (IPFS or data URI)
     * @return tokenId The newly minted token ID
     * @dev Anyone can call this - designed for game integration
     */
    function mintNFT(string calldata tokenURI_) external returns (uint256) {
        return _mintWithURI(msg.sender, tokenURI_);
    }
    
    /**
     * @notice Mint a new NFT to a specific address with custom tokenURI
     * @param to Recipient address
     * @param tokenURI_ The metadata URI for this token
     * @return tokenId The newly minted token ID
     * @dev Alternative mint function for flexibility
     */
    function safeMint(address to, string calldata tokenURI_) external returns (uint256) {
        return _mintWithURI(to, tokenURI_);
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Burn a token (admin only)
     * @param tokenId The token ID to burn
     * @dev Only contract owner can burn tokens
     */
    function adminBurn(uint256 tokenId) external onlyOwner {
        address tokenOwner = ownerOf(tokenId);
        
        // Clear token URI
        delete _tokenURIs[tokenId];
        
        // Burn the token
        _burn(tokenId);
        
        emit NFTBurned(tokenOwner, tokenId);
    }
    
    /**
     * @notice Update token metadata URI (admin only)
     * @param tokenId The token ID to update
     * @param newTokenURI The new metadata URI
     * @dev Emits MetadataUpdate for Farcaster/marketplace indexers
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        _tokenURIs[tokenId] = newTokenURI;
        
        // Emit ERC4906 MetadataUpdate event
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice Emit batch metadata update event (admin only)
     * @param fromTokenId Start of token range
     * @param toTokenId End of token range
     * @dev Useful for bulk metadata refreshes
     */
    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    // ============ View Functions ============
    
    /**
     * @notice Get the metadata URI for a token
     * @param tokenId The token ID to query
     * @return The token's metadata URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return _tokenURIs[tokenId];
    }
    
    /**
     * @notice Get the total number of tokens minted
     * @return Total supply (minted tokens, may include burned)
     */
    function totalSupply() external view returns (uint256) {
        unchecked {
            return _nextTokenId - 1;
        }
    }
    
    /**
     * @notice Get the next token ID that will be minted
     * @return The next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    // ============ ERC165 Interface Support ============
    
    /**
     * @notice Check if contract supports an interface
     * @param interfaceId The interface identifier to check
     * @return True if the interface is supported
     * @dev Includes ERC4906 (0x49064906) for metadata updates
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return 
            interfaceId == 0x49064906 || // ERC4906 (Metadata Update Extension)
            super.supportsInterface(interfaceId);
    }

    // ============ Internal Functions ============
    
    /**
     * @dev Internal function to mint with URI
     * @param to Recipient address
     * @param tokenURI_ Token metadata URI
     * @return tokenId The minted token ID
     */
    function _mintWithURI(address to, string calldata tokenURI_) private returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(tokenURI_).length > 0, "Token URI required");
        
        uint256 tokenId = _nextTokenId;
        
        // Safe increment (unchecked for gas savings, overflow practically impossible)
        unchecked {
            _nextTokenId++;
        }
        
        // Mint the token
        _safeMint(to, tokenId);
        
        // Store the token URI
        _tokenURIs[tokenId] = tokenURI_;
        
        // Emit events for indexers (Farcaster, OpenSea, etc.)
        emit NFTMinted(to, tokenId, tokenURI_);
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }
    
    /**
     * @dev Check if a token exists
     * @param tokenId Token ID to check
     * @return True if the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
}
