const LotteryOffice = artifacts.require("LotteryOffice");
//const LotteryUtils = artifacts.require("LotteryUtils");
const Lottery = artifacts.require("Lottery");
const { deployProxy } = require('@openzeppelin/truffle-upgrades');

module.exports = async function (deployer) {
  // TUSDT 0xe340df50F8223bF6d0422305Ffb257F4c02B0CE0
  const lotteryOffice = await deployProxy(LotteryOffice, ["0xe340df50F8223bF6d0422305Ffb257F4c02B0CE0",// TUSDT 0xe340df50F8223bF6d0422305Ffb257F4c02B0CE0
  "0x80a17E19eE3E8CF515aaC544A2E58964a951d713",// Lotto 0x80a17E19eE3E8CF515aaC544A2E58964a951d713
  "0x4a1919E753D176D39ce76315A82851CE6801942E",// Factory 0x4a1919E753D176D39ce76315A82851CE6801942E
  3], { deployer, unsafeAllowLinkedLibraries: true });
  console.log('Deployed LotteryOffice', lotteryOffice.address);

  const lottery = await deployProxy(Lottery, ["0x80a17E19eE3E8CF515aaC544A2E58964a951d713",// Lotto 0x80a17E19eE3E8CF515aaC544A2E58964a951d713
    "0xe340df50F8223bF6d0422305Ffb257F4c02B0CE0",// TUSDT 0xe340df50F8223bF6d0422305Ffb257F4c02B0CE0
    "0x4a1919E753D176D39ce76315A82851CE6801942E",// Factory 0x4a1919E753D176D39ce76315A82851CE6801942E
    "0xfB7f985239903Ff3061E2A424336230EF3637DE2",// Router02 0xfB7f985239903Ff3061E2A424336230EF3637DE2
    lotteryOffice.address, 80, 100, 20, 1, 5], { deployer, unsafeAllowLinkedLibraries: true });
  console.log('Deployed Lottery', lottery.address);

};