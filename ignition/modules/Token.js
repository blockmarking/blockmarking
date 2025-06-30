const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

const DeployModule = buildModule("TokenModule", (m) => {
  const marketPlace = m.contract("nftwab");
  return marketPlace;
});

module.exports = DeployModule;
