// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "truffle/Assert.sol";
import "../contracts/LotteryUtils.sol";

contract TestLotteryUtils {
    //
    // Remaining Pool Amount
    //
    function testGetRemainingPoolAmountInitialCaseShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRemainingPoolAmount(
            1000000, //_currentStakedStableAmount
            0, //_currentBetAmount
            0, //_currentTotalBetAmount
            100 //_totalLotteryNumber
        );

        Assert.equal(result, 10000, "Result not correct");
    }

    function testGetRemainingPoolAmountAmountEqualToAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRemainingPoolAmount(
            1000000, //_currentStakedStableAmount
            100, //_currentBetAmount
            10000, //_currentTotalBetAmount
            100 //_totalLotteryNumber
        );

        Assert.equal(result, 10000, "Result not correct");
    }

    function testGetRemainingPoolAmountAmountLessThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRemainingPoolAmount(
            1000000, //_currentStakedStableAmount
            20, //_currentBetAmount
            10000, //_currentTotalBetAmount
            100 //_totalLotteryNumber
        );

        Assert.equal(result, 10080, "Result not correct");
    }

    function testGetRemainingPoolAmountAmountMoreThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRemainingPoolAmount(
            1000000, //_currentStakedStableAmount
            500, //_currentBetAmount
            10000, //_currentTotalBetAmount
            100 //_totalLotteryNumber
        );

        Assert.equal(result, 9600, "Result not correct");
    }

    //
    // Reward Multiplier
    //
    function testGetRewardMultiplierInitialCaseShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRewardMultiplier(
            1000000, //_currentStakedStableAmount
            0, //_currentBetAmount
            0, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80 // _maxRewardMultiplier
        );

        Assert.equal(result, 80, "Result not correct");
    }

    function testGetRewardMultiplierAmountEqualToAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRewardMultiplier(
            1000000, //_currentStakedStableAmount
            100, //_currentBetAmount
            10000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80 // _maxRewardMultiplier
        );

        Assert.equal(result, 80, "Result not correct");
    }

    function testGetRewardMultiplierAmountLessThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRewardMultiplier(
            1000000, //_currentStakedStableAmount
            20, //_currentBetAmount
            100000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80 // _maxRewardMultiplier
        );

        Assert.equal(result, 87, "Result not correct");
    }

    function testGetRewardMultiplierAmountMoreThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getRewardMultiplier(
            1000000, //_currentStakedStableAmount
            5000, //_currentBetAmount
            15000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80 // _maxRewardMultiplier
        );

        Assert.equal(result, 41, "Result not correct");
    }

    //
    // Max Allow Bet Amount
    //
    function testGetMaxAllowBetAmountInitialCaseShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getMaxAllowBetAmount(
            1000000, //_currentStakedStableAmount
            0, //_currentBetAmount
            0, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80, // _maxRewardMultiplier
            20 // _maxMultiplierSlippageTolerancePercentage
        );

        Assert.equal(result, 2000, "Result not correct");
    }

    function testGetMaxAllowBetAmountAmountEqualToAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getMaxAllowBetAmount(
            1000000, //_currentStakedStableAmount
            100, //_currentBetAmount
            10000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80, // _maxRewardMultiplier
            20 // _maxMultiplierSlippageTolerancePercentage
        );

        Assert.equal(result, 2000, "Result not correct");
    }

    function testGetMaxAllowBetAmountAmountLessThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getMaxAllowBetAmount(
            1000000, //_currentStakedStableAmount
            20, //_currentBetAmount
            100000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80, // _maxRewardMultiplier
            20 // _maxMultiplierSlippageTolerancePercentage
        );

        Assert.equal(result, 2196, "Result not correct");
    }

    function testGetMaxAllowBetAmountAmountMoreThanAverageShouldReturnAmountCorrectly()
        public
    {
        uint256 result = LotteryUtils.getMaxAllowBetAmount(
            1000000, //_currentStakedStableAmount
            5000, //_currentBetAmount
            15000, //_currentTotalBetAmount
            100, //_totalLotteryNumber
            80, // _maxRewardMultiplier
            20 // _maxMultiplierSlippageTolerancePercentage
        );

        Assert.equal(result, 1030, "Result not correct");
    }


}
