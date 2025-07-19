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
    "0x2fcB0a5C9Fa846A7A950Cdb191d9F3Fc03161FA8"
  );

  return { tokenA, tokenB, simpleSwap };
});
