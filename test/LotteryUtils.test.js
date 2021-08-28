const LotteryUtils = artifacts.require("LotteryUtils");

contract("LotteryUtils", (accounts) => {

  before(async () => {
    lotteryUtils = await LotteryUtils.new();
  })

  describe("LotteryUtils.getRemainingPoolAmount", async () => {
    it("when no any bet happened, then should return remaining pool amount correctly", async () => {

      let result = await lotteryUtils.getRemainingPoolAmount(
        web3.utils.toWei('1000000'), //_currentStakedStableAmount
        web3.utils.toWei('0'), //_currentBetAmount
        web3.utils.toWei('0'), //_currentTotalBetAmount
        100 //_totalLotteryNumber
      );

      result = web3.utils.fromWei(result);
      assert.equal(result, '10000');
    })

    it("when bet amount = average bet amount then should return remaining pool amount correctly", async () => {
      let result = await lotteryUtils.getRemainingPoolAmount(
        web3.utils.toWei('1000000'), //_currentStakedStableAmount
        web3.utils.toWei('100'), //_currentBetAmount
        web3.utils.toWei('10000'), //_currentTotalBetAmount
        100 //_totalLotteryNumber
      );

      result = web3.utils.fromWei(result);
      assert.equal(result, '10000');
    })

    it("when bet amount < average bet amount then should return remaining pool amount correctly", async () => {
      let result = await lotteryUtils.getRemainingPoolAmount(
        web3.utils.toWei('1000000'), //_currentStakedStableAmount
        web3.utils.toWei('20'), //_currentBetAmount
        web3.utils.toWei('10000'), //_currentTotalBetAmount
        100 //_totalLotteryNumber
      );

      result = web3.utils.fromWei(result);
      assert.equal(result, '10080');
    })

    it("when bet amount > average bet amount then should return remaining pool amount correctly", async () => {
      let result = await lotteryUtils.getRemainingPoolAmount(
        web3.utils.toWei('1000000'), //_currentStakedStableAmount
        web3.utils.toWei('500'), //_currentBetAmount
        web3.utils.toWei('10000'), //_currentTotalBetAmount
        100 //_totalLotteryNumber
      );

      result = web3.utils.fromWei(result);
      assert.equal(result, '9600');
    })

  })


  describe("LotteryUtils.getRewardMultiplier", async () => {
    it("when no any bet happened, then should return reward multiplier correctly", async () => {

      let result = await lotteryUtils.getRewardMultiplier(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('0'), // _currentBetAmount,
        web3.utils.toWei('0'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier
      );

      assert.equal(result, '80');
    })

    it("when bet amount = average bet amount, then should return reward multiplier correctly", async () => {

      let result = await lotteryUtils.getRewardMultiplier(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('100'), // _currentBetAmount,
        web3.utils.toWei('10000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier
      );

      assert.equal(result, '80');
    })

    it("when bet amount < average bet amount, then should return reward multiplier correctly", async () => {

      let result = await lotteryUtils.getRewardMultiplier(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('20'), // _currentBetAmount,
        web3.utils.toWei('100000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier
      );

      assert.equal(result, '87');
    })

    it("when bet amount > average bet amount, then should return reward multiplier correctly", async () => {

      let result = await lotteryUtils.getRewardMultiplier(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('5000'), // _currentBetAmount,
        web3.utils.toWei('15000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier
      );

      assert.equal(result, '41');
    })

  })

  describe("LotteryUtils.getMaxAllowBetAmount", async () => {
    it("when no any bet happened, then should return max allow bet amount correctly", async () => {

      let result = await lotteryUtils.getMaxAllowBetAmount(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('0'), // _currentBetAmount,
        web3.utils.toWei('0'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier,
        20, // _maxMultiplierSlippageTolerancePercentage
      );

      result = web3.utils.fromWei(result);

      assert.equal(result, '2000');
    })

    it("when bet amount = average bet amount, then should return max allow bet amount correctly", async () => {

      let result = await lotteryUtils.getMaxAllowBetAmount(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('100'), // _currentBetAmount,
        web3.utils.toWei('10000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier,
        20, // _maxMultiplierSlippageTolerancePercentage
      );

      result = web3.utils.fromWei(result);

      assert.equal(result, '2000');
    })

    it("when bet amount > average bet amount, then should return max allow bet amount correctly", async () => {

      let result = await lotteryUtils.getMaxAllowBetAmount(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('5000'), // _currentBetAmount,
        web3.utils.toWei('15000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier,
        20, // _maxMultiplierSlippageTolerancePercentage
      );

      result = web3.utils.fromWei(result);

      assert.equal(result, '1030');
    })

    it("when bet amount < average bet amount, then should return max allow bet amount correctly", async () => {

      let result = await lotteryUtils.getMaxAllowBetAmount(
        web3.utils.toWei('1000000'), // _currentStakedStableAmount,
        web3.utils.toWei('20'), // _currentBetAmount,
        web3.utils.toWei('10000'), // _currentTotalBetAmount,
        100, // _totalLotteryNumber,
        80, // _maxRewardMultiplier,
        20, // _maxMultiplierSlippageTolerancePercentage
      );

      result = web3.utils.fromWei(result);

      assert.equal(result, '2016');
    })
  })

})
