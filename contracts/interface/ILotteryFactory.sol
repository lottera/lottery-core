// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILotteryFactory {
    event LotteryCreated(
        string lotteryName,
        uint256 maxRewardMultiplier,
        uint16 totalLotteryNumber,
        uint8 totalWinningNumber
    );

    function createNewLottery(
        string calldata _lotteryName,
        address _lotto,
        address _stable,
        address _factory,
        address _router,
        uint256 _maxRewardMultiplier,
        uint16 _totalLotteryNumber,
        uint256 _maxMultiplierSlippageTolerancePercentage,
        uint8 _totalWinningNumber,
        uint256 _feePercentage
    ) external returns (address lottery);

    function lockBankerAmount(uint256 _amount) external;
    function unlockBankerAmount(uint256 _amount) external;
    function withdrawBankerAmount(uint256 _amount) external;
    function depositBankerAmount(uint256 _amount) external;
    function stake(uint256 _amount) external;
    function unstake(uint256 _amount) external;
    
    function getAvailableBankerAmount() external view returns (uint256 availableAmount);
    function getStakedAmount(address _banker) external view returns (uint256 tvl);
    function getTvl() external view returns (uint256 tvl);
    function getEstimatedApy() external view returns (uint256 estimatedApy);
}

