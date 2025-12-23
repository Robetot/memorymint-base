// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC721Receiver
 * @dev Interface for contracts that want to support safeTransfers from ERC721 tokens.
 */
interface IERC721Receiver {
    /**
     * @dev Called when an ERC721 token is transferred to this contract via safeTransferFrom.
     * @param operator The address which initiated the transfer
     * @param from The address which previously owned the token
     * @param tokenId The NFT identifier being transferred
     * @param data Additional data with no specified format
     * @return bytes4 `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}
