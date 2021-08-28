const truffleAssert = require('truffle-assertions');

const Lotto = artifacts.require("Lotto");
const Lottery = artifacts.require("Lottery");
const LotteryFactory = artifacts.require("LotteryFactory");
const LotteryUtils = artifacts.require("LotteryUtils");
const truffleContract = require('@truffle/contract');
const TUSDT = artifacts.require("TestUSDT");
const UniswapV2FactoryBytecode = require('./bytecode/UniswapV2Factory.json');
const UniswapV2Factory = truffleContract(UniswapV2FactoryBytecode);
const UniswapV2Router02Bytecode = require('./bytecode/UniswapV2Router02.json');
const UniswapV2Router02 = truffleContract(UniswapV2Router02Bytecode);



contract("Lottery", (accounts) => {

  before(async () => {
    lotto = await Lotto.new(100000000);
    tusdt = await TUSDT.new(100000000);
    UniswapV2Factory.setProvider(web3.currentProvider);
    UniswapV2Router02.setProvider(web3.currentProvider);
    factory = await UniswapV2Factory.new(accounts[0], { from: accounts[0] });
    router02 = await UniswapV2Router02.new(factory.address, tusdt.address, { from: accounts[0] });
    
    // Create lotto/tusdt lp at Uniswap
    let tusdtAmount = web3.utils.toWei('10000');
    let lottoAmount = web3.utils.toWei('1000000');
    await tusdt.increaseAllowance(router02.address, tusdtAmount, { from: accounts[0] });
    await lotto.increaseAllowance(router02.address, lottoAmount, { from: accounts[0] });
    await router02.addLiquidity(
      tusdt.address,
      lotto.address,
      tusdtAmount,
      lottoAmount,
      tusdtAmount,
      lottoAmount,
      accounts[0],
      Date.now() + 3600, { from: accounts[0] });

    // Transfer tusdt and lotto to all accounts
    let transferAmount = web3.utils.toWei('100000');
    for (let i = 1; i < 10; i++) {
      await tusdt.transfer(accounts[i], transferAmount, { from: accounts[0] });
      await lotto.transfer(accounts[i], transferAmount, { from: accounts[0] });
    }
  })

  beforeEach(async () => {
    lotteryUtils = await LotteryUtils.new();
    //Lottery.link('LotteryUtils', lotteryUtils.address);
    // max multiplier = 80, totalLottery = 100 (00-99), total winning number = 1, fee 2%
    //lottery = await Lottery.new(lotto.address, tusdt.address, factory.address, router02.address, 80, 100, 20, 1, 2);

    LotteryFactory.link('LotteryUtils', lotteryUtils.address);
    lotteryFactory = await LotteryFactory.new();
    await lotteryFactory.createNewLottery("2DigitsThai", lotto.address, tusdt.address, factory.address, router02.address, 80, 100, 20, 1, 2);
    newLottery = await lotteryFactory.getLotteryAddress("2DigitsThai");
    lottery = await Lottery.at(newLottery);
  })

  describe("banker", async () => {
    it("banker can stake stable coin to contract", async () => {
      let amount = web3.utils.toWei('1000');

      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");
    })

    it("banker can stake addition stable coin to contract", async () => {
      let amount = web3.utils.toWei('1000');

      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '2000', "Staked balance should be 1000 x 2 = 2000");
      assert.equal(balanceOfContract, '2000', "Contract's stable balance should be 1000");
    })

    it("banker cannot stake 0 amount", async () => {
      let amount = web3.utils.toWei('0');

      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await truffleAssert.reverts(
        lottery.stakeStable(amount, { from: accounts[0] }),
        "Stake amount should be more than 0"
      );
    })

    it("banker cannot unstake some stable coin from contract if there are locked amount", async () => {
      let amount = web3.utils.toWei('100000');
      let unstakeAmount = web3.utils.toWei('95000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '100000', "Staked balance should be 100000");
      assert.equal(balanceOfContract, '100000', "Contract's stable balance should be 100000");

      let weiAmount = web3.utils.toWei('10000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let locked = await lottery.getLockedStableAmount({ from: accounts[0] })
      locked = web3.utils.fromWei(locked)
      await truffleAssert.reverts(
        lottery.unstakeStable(unstakeAmount, { from: accounts[0] }),
        "Cannot unstake more than unlocked amount"
      );
    })

    it("banker cannot unstake some stable coin from contract if it is less than locked amount", async () => {
      let amount = web3.utils.toWei('100000');
      let unstakeAmount = web3.utils.toWei('90000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '100000', "Staked balance should be 100000");
      assert.equal(balanceOfContract, '100000', "Contract's stable balance should be 100000");

      let weiAmount = web3.utils.toWei('100');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      await lottery.unstakeStable(unstakeAmount, { from: accounts[0] })

      actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '10000', "Remaining balance should be 10000");
      assert.equal(balanceOfContract, '10000', "Contract's remaining stable balance should be 10000");
    })

    it("banker can unstake stable coin from contract", async () => {
      let initBalanceOfBanker = await tusdt.balanceOf(accounts[0]);
      let amount = web3.utils.toWei('1000');
      let unstakeAmount = web3.utils.toWei('500');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");

      await lottery.unstakeStable(unstakeAmount, { from: accounts[0] });

      actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      balanceOfContract = await tusdt.balanceOf(lottery.address);
      balanceOfContract = web3.utils.fromWei(balanceOfContract);

      let currentBalanceOfBanker = await tusdt.balanceOf(accounts[0]);
      let diffBankerBalance = web3.utils.fromWei(initBalanceOfBanker) - web3.utils.fromWei(currentBalanceOfBanker);
      assert.equal(actual, '500', "Staked balance should be 0");
      assert.equal(balanceOfContract, '500', "Contract's stable balance should be 0");
      assert.equal(diffBankerBalance, '500', "Banker's should spend 500 stable coin");
    })

    it("banker cannot unstake stable coin more than staked amount", async () => {
      let amount = web3.utils.toWei('1000');
      let unstakeAmount = web3.utils.toWei('5000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });

      await lottery.stakeStable(amount, { from: accounts[0] });

      let actual = await lottery.getBankerStableStakedAmount({ from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");

      await truffleAssert.reverts(
        lottery.unstakeStable(unstakeAmount, { from: accounts[0] }),
        "Unstake amount cannot more than staked amount"
      );
    })
  })

  describe("only owner", async () => {
    it("only owner should be able to call close lottery", async () => {
      await truffleAssert.reverts(
        lottery.closeLottery({ from: accounts[1] }),
        "Ownable: caller is not the owner"
      );
    })

    it("only owner can add 2 digits winning number correctly", async () => {
      let numbers = [22, 33, 44, 55, 66, 77, 88];
      await lottery.adjustTotalWinningNumber(7, { from: accounts[0] });
      await lottery.closeLottery({ from: accounts[0] });
      await lottery.setWinningNumbers(numbers, { from: accounts[0] });
      let results = await lottery.getWinningNumbers({ from: accounts[0] });
      assert.equal(results.toString(), '22,33,44,55,66,77,88', "Should contains winning number without duplicated");
    })

    it("cannot add 2 digits winning number that contain duplicated", async () => {
      let numbers = [22, 33, 44, 55, 66, 77, 77];
      await lottery.adjustTotalWinningNumber(7, { from: accounts[0] });
      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.setWinningNumbers(numbers, { from: accounts[0] }),
        "Total winning numbers is not corrected"
      );
      let results = await lottery.getWinningNumbers({ from: accounts[0] });
      assert.equal(results.toString(), '', "Should contains empty winning numbers");
    })


    it("cannot add 2 digits winning number that > 99", async () => {
      let numbers = [22, 33, 44, 100];
      await lottery.adjustTotalWinningNumber(4, { from: accounts[0] });
      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.setWinningNumbers(numbers, { from: accounts[0] }),
        "Invalid winning number"
      );
    })

    it("cannot add winning number if status is not closed", async () => {
      let numbers = [22, 33, 44];
      await lottery.adjustTotalWinningNumber(3, { from: accounts[0] });
      await truffleAssert.reverts(
        lottery.setWinningNumbers(numbers, { from: accounts[0] }),
        "Current lottery should be Status.Closed"
      );
    })

    it("cannot add winning number more than limit", async () => {
      let numbers = [22, 33, 44, 100];
      await lottery.adjustTotalWinningNumber(1, { from: accounts[0] });
      await truffleAssert.reverts(
        lottery.setWinningNumbers(numbers, { from: accounts[0] }),
        "Total winning numbers is not corrected"
      );
    })
  })

  describe("gambler", async () => {
    it("gambler should not able to buy if lottery is closed", async () => {
      let amount = 80;
      let weiAmount = web3.utils.toWei('80');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }, {
        lotteryNumber: 2,
        amount: weiAmount
      }, {
        lotteryNumber: 3,
        amount: weiAmount
      }];
      let totalAmount = amount * lotteries.length
      let weiTotalAmount = web3.utils.toWei(totalAmount.toString());
      await lotto.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });
      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Current lottery should be Status.Open"
      );
    })

    it("gambler should not able to buy lottery more than max allowance amount", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('1000');
      await tusdt.increaseAllowance(lottery.address, stakeAmount, { from: accounts[0] });
      await lottery.stakeStable(stakeAmount, { from: accounts[0] });

      let amount = 8000;
      let weiAmount = web3.utils.toWei('8000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }, {
        lotteryNumber: 2,
        amount: weiAmount
      }, {
        lotteryNumber: 3,
        amount: weiAmount
      }];
      let totalAmount = amount * lotteries.length
      let weiTotalAmount = web3.utils.toWei(totalAmount.toString());
      await lotto.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Lottery amount exceed max allowance"
      );

    })

    it("gambler should able to buy lotteries and transfer lotto to contract", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, stakeAmount, { from: accounts[0] });
      await lottery.stakeStable(stakeAmount, { from: accounts[0] });

      let amount = 80;
      let weiAmount = web3.utils.toWei('80');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }, {
        lotteryNumber: 2,
        amount: weiAmount
      }, {
        lotteryNumber: 3,
        amount: weiAmount
      }];
      let totalAmount = amount * lotteries.length
      let weiTotalAmount = web3.utils.toWei(totalAmount.toString());
      await lotto.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let balanceOfContract = await lotto.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      let allGamblingInfo = await lottery.getAllGamblingInfo({ from: accounts[0] });

      lotteries.forEach(lottery => {
        let filteredGambling = allGamblingInfo.filter(gambling => gambling.lotteryNumber == lottery.lotteryNumber);
        assert.equal(filteredGambling[0].amount, weiAmount, `Gambling amount balance should be ${weiAmount}`);
      });

      assert.equal(balanceOfContract, totalAmount.toString(), `Contract's stable balance should be ${totalAmount.toString()}`);
    })

    it("gambler should able to buy lotteries and transfer lotto to contract when lottery was closed and reopened", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, stakeAmount, { from: accounts[0] });
      await lottery.stakeStable(stakeAmount, { from: accounts[0] });

      let amount = 80;
      let weiAmount = web3.utils.toWei('80');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }, {
        lotteryNumber: 2,
        amount: weiAmount
      }, {
        lotteryNumber: 3,
        amount: weiAmount
      }];
      let totalAmount = amount * lotteries.length
      let weiTotalAmount = web3.utils.toWei(totalAmount.toString());
      await lotto.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Current lottery should be Status.Open"
      );
      await lottery.reopenLottery({ from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let balanceOfContract = await lotto.balanceOf(lottery.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      let allGamblingInfo = await lottery.getAllGamblingInfo({ from: accounts[0] });

      lotteries.forEach(lottery => {
        let filteredGambling = allGamblingInfo.filter(gambling => gambling.lotteryNumber == lottery.lotteryNumber);
        assert.equal(filteredGambling[0].amount, weiAmount, `Gambling amount balance should be ${weiAmount}`);
      });

      assert.equal(balanceOfContract, totalAmount.toString(), `Contract's stable balance should be ${totalAmount.toString()}`);
    })
  })

  describe("viewable", async () => {
    it("should be able to get correct reward multiplier", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('1000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 80, `default reward multiplier should be 80`);
    })

    it("should be able to get correct reward multiplier after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('10000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 72, `reward multiplier should be 72`);
    })

    it("should be able to get correct reward multiplier after some lotteries bought and more stable was staked", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('10000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      // Stake stable before can get reward multiplier
      amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 76, `reward multiplier should be 76`);
    })

    it("should be able to get correct max allow bet amount", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let maxAllowBetAmount = await lottery.getMaxAllowBetAmount(1, { from: accounts[0] });
      maxAllowBetAmount = web3.utils.fromWei(maxAllowBetAmount);
      assert.equal(maxAllowBetAmount, 20000, `default max allow bet amount should be 20000`);

      await buyLottery(1, 2000, accounts[9]);

      maxAllowBetAmount = await lottery.getMaxAllowBetAmount(1, { from: accounts[0] });
      maxAllowBetAmount = web3.utils.fromWei(maxAllowBetAmount);
      assert.equal(maxAllowBetAmount, 19600, `max allow bet amount after some lotteries bought should be 19600`);
    })

    it("should be able to get correct locked stable amount after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('1000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStableAmount = await lottery.getLockedStableAmount({ from: accounts[0] });
      lockedStableAmount = web3.utils.fromWei(lockedStableAmount);
      assert.equal(lockedStableAmount, 860.344333761327413294, `lock stable amount should be (1000x80 - 1000) lotto -> conver to stable using uniswap`);
    })

    it("should be able to get correct locked stable amount by using max reward from all number", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });


      // number 1
      let weiAmount = web3.utils.toWei('1000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      // number 2
      weiAmount = web3.utils.toWei('1100');
      lotteries = [{
        lotteryNumber: 2,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStableAmount = await lottery.getLockedStableAmount({ from: accounts[0] });
      lockedStableAmount = web3.utils.fromWei(lockedStableAmount);
      assert.equal(lockedStableAmount, 942.549780399068335079, `lock stable amount should be (1100x80 - 1000 - 1100) lotto -> conver to stable using uniswap`);
    })

    it("should be able to get correct locked stable percentage after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('1000');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await lotto.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStablePercentage = await lottery.getLockedStablePercentage({ from: accounts[0] });
      lockedStablePercentage = web3.utils.fromWei(lockedStablePercentage);
      assert.equal(lockedStablePercentage, 0.860344333761327413, `incorrect locked stable percentage`);
    })
  })

  describe("e2e", async () => {

    it("reward should be calculated correctly for each gambler - banker lose", async () => {
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 100, accounts[1]);
      await buyLottery(1, 100, accounts[2]);
      await buyLottery(2, 100, accounts[3]);
      await buyLottery(3, 100, accounts[4]);
      await buyLottery(4, 100, accounts[5]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(8000, accounts[1]);
      await validateClaimableReward(7900, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(0, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(99843.120668118513574442, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });
      await lottery.claimReward({ from: accounts[2] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);

      // 9. assert gambler lotto balance
      await validateLottoBalance(107900, accounts[1]);
      await validateLottoBalance(107800, accounts[2]);
    })

    it("reward should be calculated correctly for each gambler - banker win", async () => {
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 100, accounts[1]);
      await buyLottery(1, 100, accounts[2]);
      await buyLottery(2, 100, accounts[3]);
      await buyLottery(3, 100, accounts[4]);
      await buyLottery(4, 10000, accounts[5]);
      await buyLottery(5, 10000, accounts[6]);
      await buyLottery(6, 10000, accounts[7]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(8000, accounts[1]);
      await validateClaimableReward(7900, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(0, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(100144.073857298840083593, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });
      await lottery.claimReward({ from: accounts[2] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);

      // 9. assert gambler lotto balance
      // This include reward from last e2e test cases
      await validateLottoBalance(115800, accounts[1]);
      await validateLottoBalance(115600, accounts[2]);
    })

    it("reward should be calculated correctly for each gambler - big gambler win", async () => {
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 100, accounts[1]);
      await buyLottery(1, 100, accounts[2]);
      await buyLottery(2, 100, accounts[3]);
      await buyLottery(3, 100, accounts[4]);
      await buyLottery(4, 10000, accounts[5]);
      await buyLottery(5, 10000, accounts[6]);
      await buyLottery(6, 10000, accounts[7]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([4], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(800000, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(66279.646525463548164775, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[5] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[5]);

      // 9. assert gambler lotto balance
      // This include reward/loss from last e2e test cases
      await validateLottoBalance(115700, accounts[1]);
      await validateLottoBalance(115500, accounts[2]);
      await validateLottoBalance(879900, accounts[5]);
    })

    it("simulate normal distribution of lottery number", async () => {
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lottery.address, amount, { from: accounts[0] });
      await lottery.stakeStable(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      for(let i = 0; i<100; i++){
        await buyLottery(i, 500, accounts[1]);
      }

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(40000, accounts[1]);


      // 6. validate banker staked amount
      await validateStakedAmount(101788.007908710008513871, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);

      // 9. assert gambler lotto balance
      // this loss 50,000 - 40,000 = 10,000
      await validateLottoBalance(105700, accounts[1]);
    })
  })

  // Helper function
  const buyLottery = async (lotteryNumber, amount, account) => {
    let weiAmount = web3.utils.toWei(amount.toString());
    let lotteries = [{
      lotteryNumber: lotteryNumber,
      amount: weiAmount
    }];
    await lotto.increaseAllowance(lottery.address, weiAmount, { from: account });
    await lottery.buyLotteries(lotteries, { from: account });

  }

  const validateClaimableReward = async (amount, account) => {
    let reward = await lottery.getClaimableReward({ from: account });
    reward = web3.utils.fromWei(reward);
    assert.equal(reward, amount, `Incorrect reward amount: ${reward}`);
  }

  const validateLottoBalance = async (amount, account) => {
    let balance = await lotto.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    assert.equal(balance, amount, `Incorrect balance amount: ${balance}`);
  }

  const validateStakedAmount = async (amount, account) => {
    let reward = await lottery.getBankerStableStakedAmount({ from: account });
    reward = web3.utils.fromWei(reward);
    assert.equal(reward, amount, `Incorrect reward amount: ${reward}`);
  }

})