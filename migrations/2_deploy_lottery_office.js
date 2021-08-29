const LotteryOffice = artifacts.require("LotteryOffice");
const LotteryUtils = artifacts.require("LotteryUtils");
const Lottery = artifacts.require("Lottery");

module.exports = function (deployer) {
  deployer.deploy(LotteryUtils)
    .then(function () {
      deployer.link(LotteryUtils, LotteryOffice);
      return deployer.deploy(LotteryOffice);
    }).then(function () {
      deployer.link(LotteryUtils, Lottery);
      return deployer.deploy(Lottery);
    });

};