// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintFarcaster - Production ERC-721 for Memory Flip Game
 * @author MemoryMint Team
 * @notice Base Mainnet optimized NFT with Farcaster integration
 * @dev No external imports - fully self-contained for Remix compatibility
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

// ============ Custom Errors ============
error NotOwner();
error ZeroAddress();
error TokenNotExist();
error NotApproved();
error NotTokenOwner();
error InvalidReceiver();
error EmptyTokenURI();

contract MemoryMintFarcaster {
    // ============ ERC721 Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    // ============ ERC4906 Events (Metadata Updates for Farcaster) ============
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);
    
    // ============ Custom Events ============
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event NFTBurned(address indexed owner, uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Storage ============
    string private _name;
    string private _symbol;
    address private _contractOwner;
    uint256 private _nextTokenId;
    
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;

    // ============ Constructor ============
    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
        _contractOwner = msg.sender;
        _nextTokenId = 1;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != _contractOwner) revert NotOwner();
        _;
    }

    // ============ ERC721 Metadata ============
    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenURIs[tokenId];
    }

    // ============ ERC721 Core ============
    function balanceOf(address owner_) external view returns (uint256) {
        if (owner_ == address(0)) revert ZeroAddress();
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner_ = _owners[tokenId];
        if (owner_ == address(0)) revert TokenNotExist();
        return owner_;
    }

    function approve(address to, uint256 tokenId) external {
        address owner_ = _owners[tokenId];
        if (msg.sender != owner_ && !_operatorApprovals[owner_][msg.sender]) revert NotApproved();
        _tokenApprovals[tokenId] = to;
        emit Approval(owner_, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) external view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert ZeroAddress();
        address owner_ = _owners[tokenId];
        if (owner_ != from) revert NotTokenOwner();
        if (msg.sender != owner_ && 
            _tokenApprovals[tokenId] != msg.sender && 
            !_operatorApprovals[owner_][msg.sender]) revert NotApproved();
        
        unchecked {
            _balances[from]--;
            _balances[to]++;
        }
        _owners[tokenId] = to;
        delete _tokenApprovals[tokenId];
        
        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            (bool success, bytes memory result) = to.call(
                abi.encodeWithSelector(0x150b7a02, msg.sender, from, tokenId, data)
            );
            if (!success || (result.length >= 32 && abi.decode(result, (bytes4)) != 0x150b7a02)) {
                revert InvalidReceiver();
            }
        }
    }

    // ============ Public Minting ============
    
    /**
     * @notice Mint a new NFT to the caller with custom tokenURI
     * @param tokenURI_ The metadata URI for this token (IPFS or data URI)
     * @return tokenId The newly minted token ID
     */
    function mintNFT(string calldata tokenURI_) external returns (uint256) {
        return _mintWithURI(msg.sender, tokenURI_);
    }
    
    /**
     * @notice Mint a new NFT to a specific address with custom tokenURI
     * @param to Recipient address
     * @param tokenURI_ The metadata URI for this token
     * @return tokenId The newly minted token ID
     */
    function safeMint(address to, string calldata tokenURI_) external returns (uint256) {
        return _mintWithURI(to, tokenURI_);
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Burn a token (admin only)
     * @param tokenId The token ID to burn
     */
    function adminBurn(uint256 tokenId) external onlyOwner {
        address tokenOwner = ownerOf(tokenId);
        
        unchecked {
            _balances[tokenOwner]--;
        }
        
        delete _owners[tokenId];
        delete _tokenApprovals[tokenId];
        delete _tokenURIs[tokenId];
        
        emit Transfer(tokenOwner, address(0), tokenId);
        emit NFTBurned(tokenOwner, tokenId);
    }
    
    /**
     * @notice Update token metadata URI (admin only)
     * @param tokenId The token ID to update
     * @param newTokenURI The new metadata URI
     */
    function updateTokenURI(uint256 tokenId, string calldata newTokenURI) external onlyOwner {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        _tokenURIs[tokenId] = newTokenURI;
        emit MetadataUpdate(tokenId);
    }
    
    /**
     * @notice Emit batch metadata update event (admin only)
     * @param fromTokenId Start of token range
     * @param toTokenId End of token range
     */
    function emitBatchMetadataUpdate(uint256 fromTokenId, uint256 toTokenId) external onlyOwner {
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }
    
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
     * @notice Get contract owner
     * @return Current owner address
     */
    function owner() external view returns (address) {
        return _contractOwner;
    }

    // ============ View Functions ============
    
    /**
     * @notice Get the total number of tokens minted
     * @return Total supply
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
     * @param interfaceId The interface identifier
     * @return True if supported
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return 
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f || // ERC721Metadata
            interfaceId == 0x49064906;   // ERC4906 (Metadata Update)
    }

    // ============ Internal Functions ============
    
    function _mintWithURI(address to, string calldata tokenURI_) private returns (uint256) {
        if (to == address(0)) revert ZeroAddress();
        if (bytes(tokenURI_).length == 0) revert EmptyTokenURI();
        
        uint256 tokenId = _nextTokenId;
        
        unchecked {
            _nextTokenId++;
            _balances[to]++;
        }
        
        _owners[tokenId] = to;
        _tokenURIs[tokenId] = tokenURI_;
        
        emit Transfer(address(0), to, tokenId);
        emit NFTMinted(to, tokenId, tokenURI_);
        emit MetadataUpdate(tokenId);
        
        // Safe mint check
        if (to.code.length > 0) {
            (bool success, bytes memory result) = to.call(
                abi.encodeWithSelector(0x150b7a02, msg.sender, address(0), tokenId, "")
            );
            if (!success || (result.length >= 32 && abi.decode(result, (bytes4)) != 0x150b7a02)) {
                revert InvalidReceiver();
            }
        }
        
        return tokenId;
    }
}
