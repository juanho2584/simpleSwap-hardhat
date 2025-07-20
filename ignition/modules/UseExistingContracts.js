const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("UseExistingContracts", (m) => {
  // Referencias a contratos ya desplegados
  const tokenA = m.contractAt(
    "TokenA",
    "0x18a5321E8D655d846c67A1441bd88FEF3DCDf391"
  );
  const tokenB = m.contractAt(
    "TokenB",
    "0x26a1E5E72fda2a3F000205B981627cE8aC6205CB"
  );
  const simpleSwap = m.contractAt(
    "SimpleSwap",
    "0xCcD61fC22cd6328596Ba4CA1a7F1d6bF793BF997"
  );

  return { tokenA, tokenB, simpleSwap };
});
