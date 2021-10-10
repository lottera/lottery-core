const LotteryOffice = artifacts.require("LotteryOffice");
const Lottery = artifacts.require("Lottery");
const LotteryUtils = artifacts.require("LotteryUtils");

module.exports = async function (deployer) {
  await deployer.deploy(LotteryUtils);
  await deployer.link(LotteryUtils, Lottery);
  await deployer.link(LotteryUtils, LotteryOffice);
  await deployer.deploy(LotteryOffice);
  await deployer.deploy(Lottery);
};