// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintFeeAware
 * @author MemoryMint Team
 * @notice Ultra-optimized ERC-721 with dynamic pricing for Base Mainnet
 * 
 * Features:
 * - Unlimited supply (no cap, no counter limits)
 * - Payable mint with dynamic pricing
 * - Owner-adjustable mintPrice (no redeployment needed)
 * - Free mint when mintPrice = 0
 * - Single-transaction mint
 * - Extreme gas optimization
 * - Works with Base App, MetaMask, Farcaster
 * 
 * Gas Optimizations:
 * - Minimal storage writes
 * - Packed storage slots
 * - No loops in mint path
 * - No external calls in mint
 * - No oracles or randomness
 * - Deterministic execution
 * 
 * Network: Base Mainnet (chainId 8453)
 * Deployment: Solidity 0.8.20, Optimizer 200 runs
 */

// ============ Custom Errors (Gas Efficient) ============
error NotContractOwner();
error NotTokenOwner();
error ZeroAddress();
error TokenNotExist();
error NotApproved();
error TransferToNonReceiver();
error InsufficientPayment();
error WithdrawFailed();

// ============ Interfaces ============
interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}

/**
 * @title MemoryMintFeeAware
 * @notice Gas-optimized ERC-721 with dynamic mint pricing
 */
contract MemoryMintFeeAware {
    // ============ Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MetadataUpdate(uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);

    // ============ Packed Storage (Gas Optimized) ============
    
    // Slot 1: Owner (20 bytes) + empty (12 bytes)
    address public owner;
    
    // Slot 2: Token counter
    uint256 private _nextTokenId;
    
    // Slot 3: Mint price in wei (0 = free)
    uint256 public mintPrice;
    
    // Slot 4-6: Collection metadata (strings stored separately)
    string private constant _name = "MemoryMint";
    string private constant _symbol = "MMINT";
    
    // ============ Mappings (Separate Slots) ============
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;

    // ============ Constants ============
    bytes4 private constant ERC721_RECEIVER_MAGIC = 0x150b7a02;

    // ============ Constructor ============
    constructor() {
        owner = msg.sender;
        _nextTokenId = 1;
        mintPrice = 0; // Start with free mints
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotContractOwner();
        _;
    }

    // ============ ERC165 Interface Detection ============
    /**
     * @notice Check if contract supports an interface
     * @dev Changed to public view for maximum tooling/indexer/marketplace compatibility
     */
    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return
            interfaceId == 0x01ffc9a7 || // ERC165
            interfaceId == 0x80ac58cd || // ERC721
            interfaceId == 0x5b5e139f || // ERC721Metadata
            interfaceId == 0x49064906;   // ERC4906
    }

    // ============ ERC721 Metadata ============
    function name() external pure returns (string memory) {
        return _name;
    }

    function symbol() external pure returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenURIs[tokenId];
    }

    // ============ ERC721 Core ============
    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotExist();
        return tokenOwner;
    }

    function approve(address to, uint256 tokenId) external {
        address tokenOwner = _owners[tokenId];
        if (msg.sender != tokenOwner && !_operatorApprovals[tokenOwner][msg.sender]) {
            revert NotTokenOwner();
        }
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        if (to == address(0)) revert ZeroAddress();
        
        address tokenOwner = _owners[tokenId];
        if (tokenOwner != from) revert NotTokenOwner();
        
        if (msg.sender != tokenOwner && 
            _tokenApprovals[tokenId] != msg.sender && 
            !_operatorApprovals[tokenOwner][msg.sender]) {
            revert NotApproved();
        }

        delete _tokenApprovals[tokenId];

        unchecked {
            _balances[from]--;
            _balances[to]++;
        }
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        transferFrom(from, to, tokenId);
        if (to.code.length > 0) {
            try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
                if (retval != ERC721_RECEIVER_MAGIC) revert TransferToNonReceiver();
            } catch {
                revert TransferToNonReceiver();
            }
        }
    }

    // ============ Minting (Gas Optimized, Payable) ============
    
    /**
     * @notice Mint a single NFT with metadata
     * @dev Payable - requires msg.value >= mintPrice (or 0 if free)
     * @param tokenURI_ IPFS URI for metadata
     * @return tokenId The minted token ID
     */
    function mintNFT(string calldata tokenURI_) external payable returns (uint256) {
        // Check payment (skip if free)
        if (msg.value < mintPrice) revert InsufficientPayment();
        
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        
        // Direct storage writes (no function call overhead)
        _owners[tokenId] = msg.sender;
        unchecked { _balances[msg.sender]++; }
        
        // Store URI if provided
        if (bytes(tokenURI_).length > 0) {
            _tokenURIs[tokenId] = tokenURI_;
        }
        
        emit Transfer(address(0), msg.sender, tokenId);
        emit MetadataUpdate(tokenId);
        
        return tokenId;
    }

    // ============ Owner Functions ============
    
    /**
     * @notice Set mint price (0 = free mint)
     * @param newPrice New price in wei
     */
    function setMintPrice(uint256 newPrice) external onlyOwner {
        uint256 oldPrice = mintPrice;
        mintPrice = newPrice;
        emit MintPriceUpdated(oldPrice, newPrice);
    }

    /**
     * @notice Transfer contract ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    /**
     * @notice Withdraw to specific address
     * @param to Recipient address
     */
    function withdrawTo(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        (bool success, ) = to.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ============ View Functions ============
    
    /**
     * @notice Get current token count
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Get next token ID
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Check if token exists
     */
    function exists(uint256 tokenId) external view returns (bool) {
        return _owners[tokenId] != address(0);
    }
}
