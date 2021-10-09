const LotteryOffice = artifacts.require("LotteryOffice");
const Lottery = artifacts.require("Lottery");

module.exports = function (deployer) {
  deployer.deploy(LotteryOffice)
    .then(function () {
      return deployer.deploy(Lottery);
    });
};