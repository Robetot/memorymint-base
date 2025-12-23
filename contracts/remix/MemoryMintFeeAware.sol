// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMintFeeAware
 * @author MemoryMint Team
 * @notice Ultra-optimized ERC-721 NFT contract for MemoryMint game
 * @dev Designed for Base Mainnet (chainId 8453) with:
 *      - Unlimited mint supply
 *      - Configurable mint price (free or paid)
 *      - One-transaction mint
 *      - Safe mint receiver protection
 *      - Full ERC-721 + ERC-165 + ERC-4906 compliance
 */

import "./IERC721Receiver.sol";

// ============ Custom Errors (Gas Optimized) ============
error ZeroAddress();
error TokenNotExist();
error NotContractOwner();
error NotTokenOwner();
error NotApproved();
error TransferToNonReceiver();
error InsufficientPayment();
error WithdrawFailed();
error ApprovalToOwner();

// ============ Contract ============
contract MemoryMintFeeAware {
    // ============ Events ============
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event MetadataUpdate(uint256 indexed tokenId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ============ Constants ============
    bytes4 private constant ERC721_RECEIVER_MAGIC = 0x150b7a02;
    bytes4 private constant ERC165_INTERFACE_ID = 0x01ffc9a7;
    bytes4 private constant ERC721_INTERFACE_ID = 0x80ac58cd;
    bytes4 private constant ERC721_METADATA_INTERFACE_ID = 0x5b5e139f;
    bytes4 private constant ERC4906_INTERFACE_ID = 0x49064906;

    // ============ Storage ============
    string public name;
    string public symbol;
    string private _baseTokenURI;
    address public owner;
    uint256 public mintPrice;
    uint256 private _tokenIdCounter;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string) private _tokenURIs;

    // ============ Modifiers ============
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotContractOwner();
        _;
    }

    // ============ Constructor ============
    constructor(string memory name_, string memory symbol_, string memory baseURI_) {
        name = name_;
        symbol = symbol_;
        _baseTokenURI = baseURI_;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ============ ERC-165 ============
    function supportsInterface(bytes4 interfaceId) public view returns (bool) {
        return interfaceId == ERC165_INTERFACE_ID ||
               interfaceId == ERC721_INTERFACE_ID ||
               interfaceId == ERC721_METADATA_INTERFACE_ID ||
               interfaceId == ERC4906_INTERFACE_ID;
    }

    // ============ ERC-721 View Functions ============
    function balanceOf(address account) external view returns (uint256) {
        if (account == address(0)) revert ZeroAddress();
        return _balances[account];
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotExist();
        return tokenOwner;
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        
        string memory _tokenURI = _tokenURIs[tokenId];
        if (bytes(_tokenURI).length > 0) {
            return _tokenURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        if (_owners[tokenId] == address(0)) revert TokenNotExist();
        return _tokenApprovals[tokenId];
    }

    function isApprovedForAll(address account, address operator) external view returns (bool) {
        return _operatorApprovals[account][operator];
    }

    // ============ ERC-721 Approval Functions ============
    function approve(address to, uint256 tokenId) external {
        address tokenOwner = _owners[tokenId];
        if (tokenOwner == address(0)) revert TokenNotExist();
        // ERC-721: Cannot approve token owner as approved address
        if (to == tokenOwner) revert ApprovalToOwner();
        if (msg.sender != tokenOwner && !_operatorApprovals[tokenOwner][msg.sender]) {
            revert NotApproved();
        }
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        if (operator == address(0)) revert ZeroAddress();
        if (operator == msg.sender) revert ApprovalToOwner();
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    // ============ ERC-721 Transfer Functions ============
    function transferFrom(address from, address to, uint256 tokenId) public {
        address tokenOwner = _owners[tokenId];
        // Explicit existence check for ERC-721 compliance
        if (tokenOwner == address(0)) revert TokenNotExist();
        if (tokenOwner != from) revert NotTokenOwner();
        if (to == address(0)) revert ZeroAddress();
        
        if (msg.sender != tokenOwner && 
            _tokenApprovals[tokenId] != msg.sender && 
            !_operatorApprovals[tokenOwner][msg.sender]) {
            revert NotApproved();
        }

        // Clear approval and emit event for marketplace compatibility
        delete _tokenApprovals[tokenId];
        emit Approval(from, address(0), tokenId);

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

    // ============ Mint Function ============
    /**
     * @notice Mint a new NFT with optional custom metadata
     * @param metadataURI Optional IPFS URI for custom metadata (can be empty for base URI)
     * @return tokenId The ID of the newly minted token
     */
    function mintNFT(string calldata metadataURI) external payable returns (uint256) {
        if (msg.value < mintPrice) revert InsufficientPayment();

        unchecked {
            _tokenIdCounter++;
        }
        uint256 tokenId = _tokenIdCounter;

        _owners[tokenId] = msg.sender;
        unchecked {
            _balances[msg.sender]++;
        }

        if (bytes(metadataURI).length > 0) {
            _tokenURIs[tokenId] = metadataURI;
        }

        emit Transfer(address(0), msg.sender, tokenId);
        emit MetadataUpdate(tokenId);
        
        // Safe mint: check ERC721Receiver if caller is a contract (prevents locked NFTs)
        if (msg.sender.code.length > 0) {
            try IERC721Receiver(msg.sender).onERC721Received(msg.sender, address(0), tokenId, "") returns (bytes4 retval) {
                if (retval != ERC721_RECEIVER_MAGIC) revert TransferToNonReceiver();
            } catch {
                revert TransferToNonReceiver();
            }
        }
        
        return tokenId;
    }

    // ============ Owner Functions ============
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner.call{value: balance}("");
        if (!success) revert WithdrawFailed();
    }

    // ============ View Helpers ============
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    // ============ Internal Helpers ============
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
            buffer[digits] = bytes1(uint8(48 + value % 10));
            value /= 10;
        }
        
        return string(buffer);
    }
}
