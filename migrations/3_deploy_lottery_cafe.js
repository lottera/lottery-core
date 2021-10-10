const LotteryCafe = artifacts.require("LotteryCafe");
const Lotto = artifacts.require("Lotto");
module.exports = async function (deployer) {
  await deployer.deploy(Lotto, 100000000)
  await deployer.deploy(LotteryCafe);
};