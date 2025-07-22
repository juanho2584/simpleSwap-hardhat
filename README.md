## SimpleSwap Hardhat Project

This project implements a small DEX (Decentralized Exchange) called **SimpleSwap** along with two ERC-20 tokens (`TokenA` and `TokenB`).
It includes a suite of automated tests with high coverage using Hardhat and the `solidity-coverage` tool.

## Contract Addresses in Sepolia

- **TokenA:** `0x18a5321E8D655d846c67A1441bd88FEF3DCDf391`  
  [View on Etherscan](https://sepolia.etherscan.io/address/0x18a5321E8D655d846c67A1441bd88FEF3DCDf391#code)

- **TokenB:** `0x26a1E5E72fda2a3F000205B981627cE8aC6205CB`  
  [See in Etherscan](https://sepolia.etherscan.io/address/0x26a1E5E72fda2a3F000205B981627cE8aC6205CB#code)

- **SimpleSwap_v2:** `0xCcD61fC22cd6328596Ba4CA1a7F1d6bF793BF997`  
  [View on Etherscan](https://sepolia.etherscan.io/address/0xCcD61fC22cd6328596Ba4CA1a7F1d6bF793BF997#code)

---

## 🚀 Contracts Description

### **TokenA and TokenB**
- These are standard **ERC-20** tokens, named **TokenA (TKA)** and **TokenB (TKB)**.
- They initially mint a fixed amount of tokens (100 billion with 18 decimals) to the deployer.
- Additional functionality:
  - `mint(address to, uint256 amount)`: only the owner can mint additional tokens.
  - `burn(uint256 amount)`: optional (if included via OpenZeppelin inheritance).
  - Standard mechanisms like `transfer`, `approve`, and `transferFrom`.

### **SimpleSwap_v2**
- This is the **DEX** that allows:
  - Adding liquidity to a pool of two tokens.
  - Swapping tokens between each other.
  - Removing liquidity and retrieving the underlying tokens.
- It uses a **x*y=k**-style reserve mechanism, calculating prices and outputs with `getAmountOut`.
- Maintains a mapping of token pairs (`pairs`) with reserves and the `totalSupply` of internal LP tokens.

## ⚙️ Main Functions of SimpleSwap_v2

### **1. addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, minA, minB, to, deadline)**
- **Description:** Creates or adds liquidity to a token pair, minting LP tokens.
- **Parameters:**
  - `tokenA, tokenB`: addresses of the tokens.
  - `amountADesired, amountBDesired`: amounts to be provided.
  - `minA, minB`: minimum contribution limits (slippage protection).
  - `to`: address of the liquidity provider.
  - `deadline`: timestamp by which the transaction must be executed.
- **Event:** `LiquidityAdded(address provider, address tokenA, address tokenB, uint256 liquidity)`.

### **2. removeLiquidity(tokenA, tokenB, liquidity, to, deadline)**
- **Description:** Removes liquidity from the pool, returning the tokens to the provider.
- **Parameters:**  
  - `liquidity`: amount of LP tokens to burn.
  - `to`: address of the recipient.
  - `deadline`: time limit.
- **Event:** `LiquidityRemoved(address provider, uint256 amountA, uint256 amountB)`.

### **3. swapExactTokensForTokens(amountIn, amountOutMin, [path], to, deadline)**
- **Description:** Executes a token swap (e.g., TokenA → TokenB).
- **Parameters:**  
  - `amountIn`: amount of input tokens.
  - `amountOutMin`: minimum output amount (slippage protection).
  - `path`: array with the input and output tokens.
  - `to`: recipient of the resulting tokens.
  - `deadline`: timestamp by which the swap must be executed.
- **Event:** `TokensSwapped(address sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)`.

### **4. getPrice(tokenA, tokenB) (view)**
- Returns the current price ratio of the pair.

### **5. getAmountOut(amountIn, tokenIn, tokenOut) (view)**
- Calculates how many tokens you would receive for a given `amountIn`.

### **6. pairs(tokenA, tokenB) (public)**
- Returns the pair information struct: reserves (`reserveA`, `reserveB`) and the LP `totalSupply`.

## 🧪 Tests

### **Coverage**
The tests cover:
- Initialization and verification of reserves (addLiquidity).
- Swaps with `amountOutMin` control.
- Adding and removing liquidity.
- Edge cases (expired deadlines, insufficient amounts).
- Metadata and functionality tests for TokenA/TokenB (transfer, mint, approve, transferFrom).

### **Test Files**
- `test/SimpleSwap.test.js`:  
  Comprehensive tests for the SimpleSwap contract.
- `test/tokens.test.js`:  
  ERC-20 tests, minting, and owner permissions for TokenA and TokenB.


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
| └── tokens.test.js
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
## 🧪 TokenA and TokenB Tests

The `test/tokens.test.js` file covers the following functions:

### **Metadata and Ownership**
- **name() and symbol():** Verifies the correct name and symbol.
- **balanceOf(address):** Checks that the deployer receives the initial supply.
- **mint(address to, uint256 amount):** Tests minting by the owner and fails for non-owners.

### **Standard ERC-20 Functions**
- **transfer(address to, uint256 amount):** Validates transfers and fails with insufficient balance.
- **approve(address spender, uint256 amount):** Verifies allowance assignments.
- **allowance(address owner, address spender):** Confirms allowance updates.
- **transferFrom(address from, address to, uint256 amount):** Validates transfers via allowance.

## 🧪 SimpleSwap_v2 Tests

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
