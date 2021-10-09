// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILotteryOffice {
    event LotteryCreated(
        string lotteryName,
        uint256 maxRewardMultiplier,
        uint16 totalLotteryNumber,
        uint8 totalWinningNumber
    );

    event StakeStableCoin(
        address indexed banker,
        uint256 amount,
        uint256 total,
        uint256 lockedLottoAmount
    );

    event UnstakeStableCoin(
        address indexed banker,
        uint256 actualStakedAmount,
        uint256 amountWithReward,
        uint256 remaining,
        uint256 unlockedLottoAmount
    );

    event DepositStableCoin(
        address indexed lotteryContract,
        string lotteryName,
        uint256 amount,
        uint256 currentStakedAmount
    );

    event WithdrawStableCoin(
        address indexed lotteryContract,
        string lotteryName,
        uint256 amount,
        uint256 currentStakedAmount
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
    function getLockedAmountPercentage() external view returns (uint256 lockedAmountPercentage);
}

