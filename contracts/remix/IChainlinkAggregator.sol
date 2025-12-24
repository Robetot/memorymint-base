// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Chainlink Aggregator Interface
 * @dev Interface for Chainlink price feed oracles
 * @notice Base Mainnet ETH/USD: 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70
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
