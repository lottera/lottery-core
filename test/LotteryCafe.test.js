const truffleAssert = require('truffle-assertions');

const Lotto = artifacts.require("Lotto");
const LotteryCafe = artifacts.require("LotteryCafe");
const truffleContract = require('@truffle/contract');
const TUSDT = artifacts.require("TestUSDT");
const IUniswapV2Pair = artifacts.require("IUniswapV2Pair");
const UniswapV2FactoryBytecode = require('./bytecode/UniswapV2Factory.json');
const UniswapV2Factory = truffleContract(UniswapV2FactoryBytecode);
const UniswapV2Router02Bytecode = require('./bytecode/UniswapV2Router02.json');
const UniswapV2Router02 = truffleContract(UniswapV2Router02Bytecode);


contract("LotteryCafe", (accounts) => {
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

    // Get lp address for creating cafe contract
    lpAddress = await factory.getPair(lotto.address, tusdt.address, { from: accounts[0] });
    lpPair = await IUniswapV2Pair.at(lpAddress);
    let rewardsPerBlock = web3.utils.toWei('2');
    lotteryCafe = await LotteryCafe.new();
    await lotteryCafe.initialize(lpAddress, lotto.address, rewardsPerBlock, 0);
    totalLpPair = await lpPair.balanceOf(accounts[0]);
    await lpPair.approve(lotteryCafe.address, totalLpPair);

    // then set minter of lotto to cafe
    // this will allow cafe to mint new token for reward
    await lotto.setMinterAddress(lotteryCafe.address);
  })



  describe("lottery cafe farming", async () => {
    it("user can stake some lp to farm and get rewards and then unstake some lp", async () => {

      let lpAmount = web3.utils.toWei('5000');
      let initialLottoBalance = await getCurrentLottoBalance(accounts[0]);
      /////////////////////////////////////////////////////////////

      await lotteryCafe.stake(lpAmount);

      let userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      
      let shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 5000);

      let rewardDebt = web3.utils.fromWei(userInfo.rewardDebt);
      assert.equal(rewardDebt, 0);

      let rewards = await lotteryCafe.getRewards(accounts[0]);
      rewards = web3.utils.fromWei(rewards);
      assert.equal(rewards, 0);

      /////////////////////////////////////////////////////////////

      await lotteryCafe.stake(lpAmount);

      userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 10000);

      rewardDebt = web3.utils.fromWei(userInfo.rewardDebt);
      assert.equal(rewardDebt, 2);

      rewards = await lotteryCafe.getRewards(accounts[0]);
      rewards = web3.utils.fromWei(rewards);
      assert.equal(rewards, 2);

      /////////////////////////////////////////////////////////////

      await lotteryCafe.stake(lpAmount);

      userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 15000);

      rewardDebt = web3.utils.fromWei(userInfo.rewardDebt);
      assert.equal(rewardDebt, 5);

      rewards = await lotteryCafe.getRewards(accounts[0]);
      rewards = web3.utils.fromWei(rewards);
      assert.equal(rewards, 4);

      /////////////////////////////////////////////////////////////

      await lotteryCafe.stake(lpAmount);

      userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 20000);

      rewardDebt = web3.utils.fromWei(userInfo.rewardDebt);
      assert.equal(rewardDebt, 8.666666665);

      rewards = await lotteryCafe.getRewards(accounts[0]);
      rewards = web3.utils.fromWei(rewards);
      assert.equal(rewards, 5.999999995);
      
      /////////////////////////////////////////////////////////////

      await lotteryCafe.claimRewards();
      let lottoBalance = await getCurrentLottoBalance(accounts[0]);
      assert.equal(lottoBalance - initialLottoBalance, 8);

      rewards = await lotteryCafe.getRewards(accounts[0]);
      rewards = web3.utils.fromWei(rewards);
      assert.equal(rewards, 0);

      /////////////////////////////////////////////////////////////
      await lotteryCafe.unstake(lpAmount);

      userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 15000);

      await lotteryCafe.unstake(userInfo.shareAmount);

      userInfo = await lotteryCafe.getUserInfo(accounts[0]);
      shareAmount = web3.utils.fromWei(userInfo.shareAmount);
      assert.equal(shareAmount, 0);

    })

  })


  // Helper function

  const getCurrentLottoBalance = async (account) => {
    let balance = await lotto.balanceOf(account);
    balance = web3.utils.fromWei(balance);
    return balance;
  }


})