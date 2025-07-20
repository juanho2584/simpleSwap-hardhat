## SimpleSwap Hardhat Project

This project implements a small DEX (Decentralized Exchange) called **SimpleSwap** along with two ERC-20 tokens (`TokenA` and `TokenB`).
It includes a suite of automated tests with high coverage using Hardhat and the `solidity-coverage` tool.

## Contents

- **Contracts:**
- `SimpleSwap`: A swap contract that allows adding/removing liquidity and swapping between `TokenA` and `TokenB`.
- `TokenA` and `TokenB`: Example ERC-20 tokens used for swapping and testing.

- **Tests:**
Tests are implemented in `test/SimpleSwap.test.js` and cover success and error cases for all critical DEX functions.

- **Coverage:**
Configuration is included to generate coverage reports with `yarn coverage`.

---

## Contract Addresses in Sepolia

- **TokenA:** `0x18a5321E8D655d846c67A1441bd88FEF3DCDf391`  
  [View on Etherscan](https://sepolia.etherscan.io/address/0x18a5321E8D655d846c67A1441bd88FEF3DCDf391#code)

- **TokenB:** `0x26a1E5E72fda2a3F000205B981627cE8aC6205CB`  
  [See in Etherscan](https://sepolia.etherscan.io/address/0x26a1E5E72fda2a3F000205B981627cE8aC6205CB#code)

- **SimpleSwap_v2:** `0xCcD61fC22cd6328596Ba4CA1a7F1d6bF793BF997`  
  [View on Etherscan](https://sepolia.etherscan.io/address/0xCcD61fC22cd6328596Ba4CA1a7F1d6bF793BF997#code)

---

## Prerequisites

- Node.js >= 18
- Yarn or npm
- [Hardhat](https://hardhat.org/)

---

## Installation

```bash
git clone https://github.com/juanho2584/simpleSwap-hardhat.git
cd simpleSwap-hardhat
yarn install
```

---

## Available Scripts

- **Run tests:**
```bash
yarn test
```

- **Generate coverage:**
```bash
yarn coverage
```

The coverage report will be generated in the `coverage/` folder.

---

## Project Structure

```
.
├── contracts/
│ ├── SimpleSwap.sol
│ ├── TokenA.sol
│ └── TokenB.sol
├── test/
│ └── SimpleSwap.test.js
├── hardhat.config.js
├── package.json
└── README.md
```

---

## Resources

- **GitHub repository:**
[https://github.com/juanho2584/simpleSwap-hardhat.git](https://github.com/juanho2584/simpleSwap-hardhat.git)

---

## License

This project is licensed under the MIT License.

---

The `test/SimpleSwap.test.js` file includes the following main tests:

- `describe("SimpleSwap (high coverage)", function () {`
- `it("deploy + addLiquidity initializes reserves and totalSupply", async function () {`
- `it("second addLiquidity (branch reserveA!=0) mints proportional LP", async function () {`
- `it("swapExactTokensForTokens A→B updates reserves and transfers tokens", async function () {`
- `it("swapExactTokensForTokens respects amountOutMin (running with min > 0)", async function () {`
- `it("removeLiquidity returns tokens and updates reserves", async function () {`
- `it("removeLiquidity total (burn all) leaves totalSupply=0", async function () {`
- `it("addLiquidity reverts for expired", async function () {`
- `it("addLiquidity reverts to identical", async function () {`
- `it("addLiquidity reverts by invalid_amt", async function () {`
- `it("addLiquidity reverts by slippage (force amountAMin > amountADesired)", async function () {`
- `it("removeLiquidity reverts for expired", async function () {`
- `it("removeLiquidity reverts to zero_liq", async function () {`
- `it("removeLiquidity reverts by insuff_bal (caller without LP)", async function () {`
- `it("removeLiquidity reverts due to slippage (very high min)", async function () {`
- `it("swap reverts for expired", async function () {`
- `it("swap reverts by invalid_path (len !=2)", async function () {`
- `it("swap reverts by invalid_path (identical tokens in path)", async function () {`
- `it("swap reverts by zero_input", async function () {`
- `it("swap reverts by slippage when amountOut < min", async function () {`
- `it("getPrice returns price when there are reservations", async function () {`
- `it("getPrice reverts to zero_resv when reverse pair is illiquid", async function () {`
- `describe("getAmountOut (pure) revert paths", function () {`
- `it("zero_input", async function () {`
- `it("bad_resv if reserveIn == 0", async function () {`
- `it("bad_resv if reserveOut == 0", async function () {`
- `it("calculates correctly with reservations >0", async function () {`
- `describe("TokenA and TokenB direct coverage", function () {`
- `it("TokenA returns decimals and totalSupply correct", async function () {`
- `it("TokenA transfer + approve + allowance", async function () {`
- `it("TokenB transfer + approve + allowance", async function () {`
