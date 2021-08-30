const truffleAssert = require('truffle-assertions');

const Lotto = artifacts.require("Lotto");
const Lottery = artifacts.require("Lottery");
const LotteryOffice = artifacts.require("LotteryOffice");
const LotteryOfficeV2Test = artifacts.require("LotteryOfficeV2Test");
const truffleContract = require('@truffle/contract');
const TUSDT = artifacts.require("TestUSDT");
const UniswapV2FactoryBytecode = require('./bytecode/UniswapV2Factory.json');
const UniswapV2Factory = truffleContract(UniswapV2FactoryBytecode);
const UniswapV2Router02Bytecode = require('./bytecode/UniswapV2Router02.json');
const UniswapV2Router02 = truffleContract(UniswapV2Router02Bytecode);
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');


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
    lotteryOffice = await deployProxy(LotteryOffice, [tusdt.address]);
    await lotteryOffice.createNewLottery("2DigitsThai", lotto.address, tusdt.address, factory.address, router02.address, 80, 100, 20, 1, 2);
    newLottery = await lotteryOffice.getLotteryAddress("2DigitsThai");
    lottery = await Lottery.at(newLottery);
  })

  describe("upgradable", async () => {
    it("banker can stake stable coin to contract and still can unstake after upgrade to v2", async () => {
      let amount = web3.utils.toWei('1000');

      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");

      // Upgrade contract
      await upgradeProxy(lotteryOffice.address, LotteryOfficeV2Test);

      let balanceAfterUpgrade = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      balanceAfterUpgrade = web3.utils.fromWei(balanceAfterUpgrade)
      assert.equal(balanceAfterUpgrade, '1000', "Staked balance should be 1000");

      let unstakeResult = await lotteryOffice.unstake(amount, { from: accounts[0] });

      // V2 Should emit event with custom amount 9999
      truffleAssert.eventEmitted(unstakeResult, 'UnstakeStableCoin', (ev) => {
        return ev.amountWithReward == 9999;
      }, 'Contract should return the correct amount.');

      // Test V2 have some bug so it should error
      await truffleAssert.reverts(
        lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] }),
        "VM Exception while processing transaction: revert"
      );
    })

  })

  describe("banker", async () => {
    it("banker can stake stable coin to contract", async () => {
      let amount = web3.utils.toWei('1000');

      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");
    })

    it("banker can stake addition stable coin to contract", async () => {
      let amount = web3.utils.toWei('1000');

      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '2000', "Staked balance should be 1000 x 2 = 2000");
      assert.equal(balanceOfContract, '2000', "Contract's stable balance should be 1000");
    })

    it("banker cannot stake 0 amount", async () => {
      let amount = web3.utils.toWei('0');

      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await truffleAssert.reverts(
        lotteryOffice.stake(amount, { from: accounts[0] }),
        "Stake amount should be more than 0"
      );
    })

    it("banker cannot unstake some stable coin from contract if there are locked amount", async () => {
      let amount = web3.utils.toWei('100000');
      let unstakeAmount = web3.utils.toWei('95000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '100000', "Staked balance should be 100000");
      assert.equal(balanceOfContract, '100000', "Contract's stable balance should be 100000");

      let weiAmount = web3.utils.toWei('100');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let locked = await lotteryOffice.currentLockedAmount_({ from: accounts[0] })
      locked = web3.utils.fromWei(locked)
      await truffleAssert.reverts(
        lotteryOffice.unstake(unstakeAmount, { from: accounts[0] }),
        "Cannot unstake more than unlocked amount"
      );
    })

    it("banker can unstake some stable coin from contract if it is less than locked amount", async () => {
      let amount = web3.utils.toWei('100000');
      let unstakeAmount = web3.utils.toWei('90000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '100000', "Staked balance should be 100000");
      assert.equal(balanceOfContract, '100000', "Contract's stable balance should be 100000");

      let weiAmount = web3.utils.toWei('1');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      await lotteryOffice.unstake(unstakeAmount, { from: accounts[0] })

      actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '10000', "Remaining balance should be 10000");
      assert.equal(balanceOfContract, '10000', "Contract's remaining stable balance should be 10000");
    })

    it("banker can unstake stable coin from contract", async () => {
      let initBalanceOfBanker = await tusdt.balanceOf(accounts[0]);
      let amount = web3.utils.toWei('1000');
      let unstakeAmount = web3.utils.toWei('500');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");

      await lotteryOffice.unstake(unstakeAmount, { from: accounts[0] });

      actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      balanceOfContract = await tusdt.balanceOf(lotteryOffice.address);
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
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let actual = await lotteryOffice.getStakedAmount(accounts[0], { from: accounts[0] });
      actual = web3.utils.fromWei(actual);

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(actual, '1000', "Staked balance should be 1000");
      assert.equal(balanceOfContract, '1000', "Contract's stable balance should be 1000");

      await truffleAssert.reverts(
        lotteryOffice.unstake(unstakeAmount, { from: accounts[0] }),
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

  describe("only lottery contract", async () => {
    it("only lottery should be able to call withdrawBankerAmount", async () => {
      let amount = web3.utils.toWei('10000');
      let withdrawAmount = web3.utils.toWei('5000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });

      await lotteryOffice.stake(amount, { from: accounts[0] });

      let balanceOfContract = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfContract = web3.utils.fromWei(balanceOfContract)

      assert.equal(balanceOfContract, '10000', "Contract's stable balance should be 10000");

      await truffleAssert.reverts(
        lotteryOffice.withdrawBankerAmount(withdrawAmount, { from: accounts[0] }),
        "OnlyLottery : caller is not valid lottery"
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
      await tusdt.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });
      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Current lottery should be Status.Open"
      );
    })

    it("gambler should not able to buy lottery more than max allowance amount", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('1000');
      await tusdt.increaseAllowance(lotteryOffice.address, stakeAmount, { from: accounts[0] });
      await lotteryOffice.stake(stakeAmount, { from: accounts[0] });

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
      await tusdt.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Lottery amount exceed max allowance"
      );

    })

    it("gambler should able to buy lotteries and transfer lotto to contract", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, stakeAmount, { from: accounts[0] });
      await lotteryOffice.stake(stakeAmount, { from: accounts[0] });

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
      await tusdt.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let balanceOfLotteryConstact = await tusdt.balanceOf(lottery.address)
      balanceOfLotteryConstact = web3.utils.fromWei(balanceOfLotteryConstact)

      let balanceOfLotteryOfficeConstact = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfLotteryOfficeConstact = web3.utils.fromWei(balanceOfLotteryOfficeConstact)

      let allGamblingInfo = await lottery.getAllGamblingInfo(accounts[0], { from: accounts[0] });

      lotteries.forEach(lottery => {
        let filteredGambling = allGamblingInfo.filter(gambling => gambling.lotteryNumber == lottery.lotteryNumber);
        assert.equal(filteredGambling[0].amount, weiAmount, `Gambling amount balance should be ${weiAmount}`);
      });

      assert.equal(balanceOfLotteryConstact, 240, "Contract's stable balance should = 240 gambler");
      assert.equal(balanceOfLotteryOfficeConstact, 100000, "Contract's stable balance should = 100000 staked");
    })

    it("gambler should able to buy lotteries and transfer lotto to contract when lottery was closed and reopened", async () => {
      // Stake stable before can get reward multiplier
      let stakeAmount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, stakeAmount, { from: accounts[0] });
      await lotteryOffice.stake(stakeAmount, { from: accounts[0] });

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
      await tusdt.increaseAllowance(lottery.address, weiTotalAmount, { from: accounts[0] });

      await lottery.closeLottery({ from: accounts[0] });
      await truffleAssert.reverts(
        lottery.buyLotteries(lotteries, { from: accounts[0] }),
        "Current lottery should be Status.Open"
      );
      await lottery.reopenLottery({ from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let balanceOfLotteryConstact = await tusdt.balanceOf(lottery.address)
      balanceOfLotteryConstact = web3.utils.fromWei(balanceOfLotteryConstact)

      let balanceOfLotteryOfficeConstact = await tusdt.balanceOf(lotteryOffice.address)
      balanceOfLotteryOfficeConstact = web3.utils.fromWei(balanceOfLotteryOfficeConstact)

      let allGamblingInfo = await lottery.getAllGamblingInfo(accounts[0], { from: accounts[0] });

      lotteries.forEach(lottery => {
        let filteredGambling = allGamblingInfo.filter(gambling => gambling.lotteryNumber == lottery.lotteryNumber);
        assert.equal(filteredGambling[0].amount, weiAmount, `Gambling amount balance should be ${weiAmount}`);
      });

      assert.equal(balanceOfLotteryConstact, 240, "Contract's stable balance should = 240 gambler");
      assert.equal(balanceOfLotteryOfficeConstact, 100000, "Contract's stable balance should = 100000 staked");
    })
  })

  describe("viewable", async () => {
    it("should be able to get correct reward multiplier", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('1000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 80, `default reward multiplier should be 80`);
    })

    it("should be able to get correct reward multiplier after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('100');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 72, `reward multiplier should be 72`);
    })

    it("should be able to get correct reward multiplier after some lotteries bought and more stable was staked", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('100');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      // Stake stable before can get reward multiplier
      amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let rewardMultiplier = await lottery.getRewardMultiplier(1, { from: accounts[0] });
      assert.equal(rewardMultiplier, 76, `reward multiplier should be 76`);
    })

    it("should be able to get correct max allow bet amount", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let maxAllowBetAmount = await lottery.getMaxAllowBetAmount(1, { from: accounts[0] });
      maxAllowBetAmount = web3.utils.fromWei(maxAllowBetAmount);
      assert.equal(maxAllowBetAmount, 200, `default max allow bet amount should be 200`);

      await buyLottery(1, 20, accounts[9]);

      maxAllowBetAmount = await lottery.getMaxAllowBetAmount(1, { from: accounts[0] });
      maxAllowBetAmount = web3.utils.fromWei(maxAllowBetAmount);
      assert.equal(maxAllowBetAmount, 196.04, `max allow bet amount after some lotteries bought should be 196.04`);
    })

    it("should be able to get correct locked stable amount after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('10');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStableAmount = await lotteryOffice.currentLockedAmount_({ from: accounts[0] });
      lockedStableAmount = web3.utils.fromWei(lockedStableAmount);
      assert.equal(lockedStableAmount, 790, `lock stable amount should be 10x80 - 10 = 790`);
    })

    it("should be able to get correct locked stable amount by using max reward from all number", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });


      // number 1
      let weiAmount = web3.utils.toWei('10');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      // number 2
      weiAmount = web3.utils.toWei('11');
      lotteries = [{
        lotteryNumber: 2,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStableAmount = await lotteryOffice.currentLockedAmount_({ from: accounts[0] });
      lockedStableAmount = web3.utils.fromWei(lockedStableAmount);
      assert.equal(lockedStableAmount, 859, `lock stable amount should be (11x80 - 10 - 11) = 859`);
    })

    it("should be able to get correct locked stable percentage after some lotteries bought", async () => {
      // Stake stable before can get reward multiplier
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      let weiAmount = web3.utils.toWei('10');
      let lotteries = [{
        lotteryNumber: 1,
        amount: weiAmount
      }];
      await tusdt.increaseAllowance(lottery.address, weiAmount, { from: accounts[0] });

      await lottery.buyLotteries(lotteries, { from: accounts[0] });

      let lockedStablePercentage = await lotteryOffice.getLockedAmountPercentage({ from: accounts[0] });
      lockedStablePercentage = web3.utils.fromWei(lockedStablePercentage);
      assert.equal(lockedStablePercentage, 0.79, `incorrect locked stable percentage`);
    })
  })

  describe("e2e", async () => {

    it("reward should be calculated correctly for each gambler - banker lose", async () => {
      const account1TUSDT = await getCurrentTUSDTBalance(accounts[1]);
      const account2TUSDT = await getCurrentTUSDTBalance(accounts[2]);

      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 10, accounts[1]);
      await buyLottery(1, 10, accounts[2]);
      await buyLottery(2, 10, accounts[3]);
      await buyLottery(3, 10, accounts[4]);
      await buyLottery(4, 10, accounts[5]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(800, accounts[1]);
      await validateClaimableReward(790, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(0, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(98460, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });
      await lottery.claimReward({ from: accounts[2] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);

      // 9. assert gambler lotto balance
      await validateTUSDTBalance(account1TUSDT - 10 + 800, accounts[1]);
      await validateTUSDTBalance(account2TUSDT - 10 + 790, accounts[2]);
    })

    it("reward should be calculated correctly for each gambler - banker win", async () => {
      const account1TUSDT = await getCurrentTUSDTBalance(accounts[1]);
      const account2TUSDT = await getCurrentTUSDTBalance(accounts[2]);
      const account0Lotto = await getCurrentLottoBalance(accounts[0]);
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 10, accounts[1]);
      await buyLottery(1, 10, accounts[2]);
      await buyLottery(2, 200, accounts[3]);
      await buyLottery(3, 200, accounts[4]);
      await buyLottery(4, 200, accounts[5]);
      await buyLottery(5, 200, accounts[6]);
      await buyLottery(6, 200, accounts[7]);
      await buyLottery(2, 150, accounts[3]);
      await buyLottery(3, 150, accounts[4]);
      await buyLottery(4, 150, accounts[5]);
      await buyLottery(5, 150, accounts[6]);
      await buyLottery(6, 150, accounts[7]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(800, accounts[1]);
      await validateClaimableReward(790, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(0, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(100176.4, accounts[0]);

      // 7. banker unstake some amount
      await unstakeBankerAmount('100000', accounts[0]);

      // 8. validate banker staked amount again
      await validateStakedAmount(176.4, accounts[0]);

      // 9. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });
      await lottery.claimReward({ from: accounts[2] });

      // 10. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);

      // 11. assert gambler lotto balance
      // This include reward from last e2e test cases
      await validateTUSDTBalance(account1TUSDT - 10 + 800, accounts[1]);
      await validateTUSDTBalance(account2TUSDT - 10 + 790, accounts[2]);

      // 12. Validate fee amount received
      await validateLottoBalance(Number(account0Lotto) + 358.791222654364895351, accounts[0]);
    })

    it("reward should be calculated correctly for each gambler - big gambler win", async () => {
      const account1TUSDT = await getCurrentTUSDTBalance(accounts[1]);
      const account2TUSDT = await getCurrentTUSDTBalance(accounts[2]);
      const account5TUSDT = await getCurrentTUSDTBalance(accounts[5]);
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      await buyLottery(1, 1, accounts[1]);
      await buyLottery(1, 1, accounts[2]);
      await buyLottery(2, 1, accounts[3]);
      await buyLottery(3, 1, accounts[4]);
      await buyLottery(4, 100, accounts[5]);
      await buyLottery(5, 100, accounts[6]);
      await buyLottery(6, 100, accounts[7]);

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([4], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(0, accounts[1]);
      await validateClaimableReward(0, accounts[2]);
      await validateClaimableReward(0, accounts[3]);
      await validateClaimableReward(0, accounts[4]);
      await validateClaimableReward(8000, accounts[5]);

      // 6. validate banker staked amount
      await validateStakedAmount(92304, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[5] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[5]);

      // 9. assert gambler lotto balance
      // This include reward/loss from last e2e test cases
      await validateTUSDTBalance(account1TUSDT - 1, accounts[1]);
      await validateTUSDTBalance(account2TUSDT - 1, accounts[2]);
      await validateTUSDTBalance(account5TUSDT - 100 + 8000, accounts[5]);
    })

    it("simulate normal distribution of lottery number", async () => {
      const account1TUSDT = await getCurrentTUSDTBalance(accounts[1]);
      // 1. banker stake stable amount
      let amount = web3.utils.toWei('100000');
      await tusdt.increaseAllowance(lotteryOffice.address, amount, { from: accounts[0] });
      await lotteryOffice.stake(amount, { from: accounts[0] });

      // 2. gambler buy lottery
      for (let i = 0; i < 100; i++) {
        await buyLottery(i, 5, accounts[1]);
      }

      // 3. close lottery
      await lottery.closeLottery({ from: accounts[0] });

      // 4. add winning number
      await lottery.setWinningNumbers([1], { from: accounts[0] });

      // 5. assert for claimable reward
      await validateClaimableReward(400, accounts[1]);


      // 6. validate banker staked amount
      await validateStakedAmount(100098, accounts[0]);

      // 7. gambler claim reqard
      await lottery.claimReward({ from: accounts[1] });

      // 8. assert for claimable reward now should be 0
      await validateClaimableReward(0, accounts[1]);

      // 9. assert gambler lotto balance
      await validateTUSDTBalance(account1TUSDT - 500 + 400, accounts[1]);
    })
  })

  // Helper function
  const buyLottery = async (lotteryNumber, amount, account) => {
    let weiAmount = web3.utils.toWei(amount.toString());
    let lotteries = [{
      lotteryNumber: lotteryNumber,
      amount: weiAmount
    }];
    await tusdt.increaseAllowance(lottery.address, weiAmount, { from: account });
    await lottery.buyLotteries(lotteries, { from: account });

  }

  const validateClaimableReward = async (amount, account) => {
    let reward = await lottery.getClaimableReward(account, { from: account });
    reward = web3.utils.fromWei(reward);
    assert.equal(reward, amount, `Incorrect reward amount: ${reward}`);
  }

  const validateTUSDTBalance = async (amount, account) => {
    let balance = await tusdt.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    assert.equal(balance, amount, `Incorrect balance amount: ${balance}`);
  }

  const validateLottoBalance = async (amount, account) => {
    let balance = await lotto.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    assert.equal(balance, amount, `Incorrect balance amount: ${balance}`);
  }

  const getCurrentTUSDTBalance = async (account) => {
    let balance = await tusdt.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    return balance;
  }

  const getCurrentLottoBalance = async (account) => {
    let balance = await lotto.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    return balance;
  }

  const validateStakedAmount = async (amount, account) => {
    let reward = await lotteryOffice.getStakedAmount(account, { from: account });
    reward = web3.utils.fromWei(reward);
    assert.equal(reward, amount, `Incorrect reward amount: ${reward}`);
  }

  const unstakeBankerAmount = async (amount, account) => {
    let weiAmount = web3.utils.toWei(amount);
    await lotteryOffice.unstake(weiAmount, { from: account });
  }

})