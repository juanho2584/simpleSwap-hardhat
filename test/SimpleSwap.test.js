const { expect } = require("chai");
const { ethers } = require("hardhat");

/*
 * -----------------------------------------------------------------------------
 * SimpleSwap – High Coverage Test Suite (~90% target lines)
 * -----------------------------------------------------------------------------
 * Covers:
 *  - Success and failure paths of addLiquidity / removeLiquidity / swapExactTokensForTokens
 *  - getPrice (success + zero_resv)
 *  - getAmountOut (success + zero_input + bad_resv)
 *  - Additional branch: second addLiquidity (pair already initialized)
 *  - Additional branch: TOTAL liquidity removal
 *  - Additional branch: swap with amountOutMin (>0) and swap with path [A,A] => invalid_path
 *  - Token coverage (tokenA / tokenB): supply, transfer, approve, allowance
 */

describe("SimpleSwap (high coverage)", function () {
  const DECIMALS = 18;
  const oneHour = 3600n;

  // Initial liquidity of the first LP
  const amountA = ethers.parseUnits("500", DECIMALS);
  const amountB = ethers.parseUnits("500", DECIMALS);
  const minAmount = ethers.parseUnits("100", DECIMALS);

  /** Returns timestamp of the latest block (BigInt). */
  async function blockTimestamp() {
    const blk = await ethers.provider.getBlock("latest");
    return BigInt(blk.timestamp);
  }

  /** Future deadline (now + 1h). */
  async function futureDeadline() {
    return (await blockTimestamp()) + oneHour;
  }

  /** Past deadline (now - 1s). */
  async function pastDeadline() {
    return (await blockTimestamp()) - 1n;
  }

  /**
   * Deploy helper:
   *  - Deploys tokenA, tokenB, SimpleSwap.
   *  - Assumes tokenA/tokenB mint supply to deployer (owner).
   *  - Approves and adds initial liquidity for owner.
   */
  async function deployTokensAndSwap() {
    const [owner, user1, user2] = await ethers.getSigners();

    const TokenA = await ethers.getContractFactory("tokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();

    const TokenB = await ethers.getContractFactory("tokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();

    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    const simpleSwap = await SimpleSwap.deploy();
    await simpleSwap.waitForDeployment();

    const tokenAAddr = await tokenA.getAddress();
    const tokenBAddr = await tokenB.getAddress();
    const simpleSwapAddr = await simpleSwap.getAddress();

    // Owner approves amounts for initial provision
    await tokenA.approve(simpleSwapAddr, amountA);
    await tokenB.approve(simpleSwapAddr, amountB);

    const deadline = await futureDeadline();

    const tx = await simpleSwap.addLiquidity(
      tokenAAddr,
      tokenBAddr,
      amountA,
      amountB,
      minAmount,
      minAmount,
      owner.address,
      deadline
    );
    const receipt = await tx.wait();

    return {
      owner,
      user1,
      user2,
      tokenA,
      tokenB,
      simpleSwap,
      tokenAAddr,
      tokenBAddr,
      simpleSwapAddr,
      addLiqReceipt: receipt,
    };
  }

  // ---------------------------------------------------------------------------
  // BASIC SUCCESS PATHS
  // ---------------------------------------------------------------------------
  it("deploy + addLiquidity initializes reserves and totalSupply", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap, addLiqReceipt } =
      await deployTokensAndSwap();

    const pair = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(pair.totalSupply).to.equal(amountA); // first LP => liquidity == amountA
    expect(pair.reserves.reserveA).to.equal(amountA);
    expect(pair.reserves.reserveB).to.equal(amountB);

    const evt = addLiqReceipt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityAdded"
    );
    expect(evt).to.not.be.undefined;
    expect(evt.args.liquidity).to.equal(amountA);
  });

  it("second addLiquidity (branch reserveA!=0) mints proportional LP", async function () {
    const {
      owner,
      tokenA,
      tokenB,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
    } = await deployTokensAndSwap();

    // Small amounts for the second provision
    const addAmtA = ethers.parseUnits("50", DECIMALS);
    const addAmtBDesired = ethers.parseUnits("1000", DECIMALS); // doesn't matter, contract recalculates

    // owner receives extra funds
    await tokenA.transfer(owner.address, addAmtA); // if supply is enough; otherwise adjust
    await tokenB.transfer(owner.address, addAmtBDesired);

    // approve extra amounts
    await tokenA.approve(simpleSwapAddr, addAmtA);
    await tokenB.approve(simpleSwapAddr, addAmtBDesired);

    const pairBefore = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    const deadline = await futureDeadline();
    const tx = await simpleSwap.addLiquidity(
      tokenAAddr,
      tokenBAddr,
      addAmtA,
      addAmtBDesired,
      0,
      0,
      owner.address,
      deadline
    );
    const rcpt = await tx.wait();

    const pairAfter = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    // totalSupply must increase
    expect(pairAfter.totalSupply).to.be.gt(pairBefore.totalSupply);

    // both reserves increase
    expect(pairAfter.reserves.reserveA).to.be.gt(pairBefore.reserves.reserveA);
    expect(pairAfter.reserves.reserveB).to.be.gt(pairBefore.reserves.reserveB);

    // event
    const evt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityAdded"
    );
    expect(evt).to.not.be.undefined;
  });

  it("swapExactTokensForTokens A→B updates reserves and transfers tokens", async function () {
    const {
      tokenA,
      tokenB,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
      user1,
    } = await deployTokensAndSwap();

    const swapAmountIn = ethers.parseUnits("100", DECIMALS);

    // move funds to user1
    await tokenA.transfer(user1.address, swapAmountIn);
    await tokenA.connect(user1).approve(simpleSwapAddr, swapAmountIn);

    const beforeB = await tokenB.balanceOf(user1.address);
    const pairBefore = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    const deadline = await futureDeadline();
    const tx = await simpleSwap.connect(user1).swapExactTokensForTokens(
      swapAmountIn,
      0, // accept any output >0
      [tokenAAddr, tokenBAddr],
      user1.address,
      deadline
    );
    const rcpt = await tx.wait();

    const afterB = await tokenB.balanceOf(user1.address);
    expect(afterB).to.be.gt(beforeB);

    const pairAfter = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(pairAfter.reserves.reserveA).to.equal(
      pairBefore.reserves.reserveA + swapAmountIn
    );
    expect(pairAfter.reserves.reserveB).to.be.lt(pairBefore.reserves.reserveB);

    const swapEvt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "TokensSwapped"
    );
    expect(swapEvt).to.not.be.undefined;
  });

  it("swapExactTokensForTokens respects amountOutMin (execution with min >0)", async function () {
    const {
      tokenA,
      tokenB,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
      user1,
    } = await deployTokensAndSwap();

    const amtIn = ethers.parseUnits("10", DECIMALS);
    await tokenA.transfer(user1.address, amtIn);
    await tokenA.connect(user1).approve(simpleSwapAddr, amtIn);

    // calculate expectedOut using the same formula as the contract
    const pair = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    const expectedOut =
      (amtIn * pair.reserves.reserveB) / (pair.reserves.reserveA + amtIn);

    const deadline = await futureDeadline();
    await simpleSwap.connect(user1).swapExactTokensForTokens(
      amtIn,
      expectedOut - 1n, // just below so it passes
      [tokenAAddr, tokenBAddr],
      user1.address,
      deadline
    );

    const gotB = await tokenB.balanceOf(user1.address);
    expect(gotB).to.be.gte(expectedOut - 1n);
  });

  it("removeLiquidity returns tokens and updates reserves", async function () {
    const { owner, tokenA, tokenB, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();

    // withdraw 100 LP (we know initial totalSupply == amountA)
    const liquidity = ethers.parseUnits("100", DECIMALS);
    const deadline = await futureDeadline();

    const balBeforeA = await tokenA.balanceOf(owner.address);
    const balBeforeB = await tokenB.balanceOf(owner.address);
    const pairBefore = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    const tx = await simpleSwap.removeLiquidity(
      tokenAAddr,
      tokenBAddr,
      liquidity,
      0,
      0,
      owner.address,
      deadline
    );
    const rcpt = await tx.wait();

    const balAfterA = await tokenA.balanceOf(owner.address);
    const balAfterB = await tokenB.balanceOf(owner.address);
    const pairAfter = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    expect(balAfterA).to.be.gt(balBeforeA);
    expect(balAfterB).to.be.gt(balBeforeB);
    expect(pairAfter.reserves.reserveA).to.be.lt(pairBefore.reserves.reserveA);
    expect(pairAfter.reserves.reserveB).to.be.lt(pairBefore.reserves.reserveB);
    expect(pairAfter.totalSupply).to.equal(pairBefore.totalSupply - liquidity);

    const rmEvt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityRemoved"
    );
    expect(rmEvt).to.not.be.undefined;
  });

  it("removeLiquidity total (burn all) leaves totalSupply=0", async function () {
    const { owner, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();

    // withdraw EVERYTHING: using totalSupply
    const pair = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    const total = pair.totalSupply;
    const deadline = await futureDeadline();
    await simpleSwap.removeLiquidity(
      tokenAAddr,
      tokenBAddr,
      total,
      0,
      0,
      owner.address,
      deadline
    );
    const after = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(after.totalSupply).to.equal(0);
    expect(after.reserves.reserveA).to.equal(0);
    expect(after.reserves.reserveB).to.equal(0);
  });

  // ---------------------------------------------------------------------------
  // REVERT PATHS: addLiquidity
  // ---------------------------------------------------------------------------
  it("addLiquidity reverts due to expired", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const expired = await pastDeadline();
    await expect(
      simpleSwap.addLiquidity(
        tokenAAddr,
        tokenBAddr,
        1,
        1,
        0,
        0,
        ethers.ZeroAddress,
        expired
      )
    ).to.be.revertedWith("expired");
  });

  it("addLiquidity reverts due to identical", async function () {
    const { tokenAAddr, simpleSwap } = await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap.addLiquidity(
        tokenAAddr,
        tokenAAddr,
        1,
        1,
        0,
        0,
        ethers.ZeroAddress,
        deadline
      )
    ).to.be.revertedWith("identical");
  });

  it("addLiquidity reverts due to invalid_amt", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap.addLiquidity(
        tokenAAddr,
        tokenBAddr,
        0,
        1,
        0,
        0,
        ethers.ZeroAddress,
        deadline
      )
    ).to.be.revertedWith("invalid_amt");
  });

  it("addLiquidity reverts due to slippage (forcing amountAMin > amountADesired)", async function () {
    const {
      owner,
      tokenA,
      tokenB,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
    } = await deployTokensAndSwap();

    const addAmtA = ethers.parseUnits("10", DECIMALS);
    const addAmtBDesired = ethers.parseUnits("10", DECIMALS);
    await tokenA.transfer(owner.address, addAmtA);
    await tokenB.transfer(owner.address, addAmtBDesired);
    await tokenA.approve(simpleSwapAddr, addAmtA);
    await tokenB.approve(simpleSwapAddr, addAmtBDesired);
    const deadline = await futureDeadline();

    await expect(
      simpleSwap.addLiquidity(
        tokenAAddr,
        tokenBAddr,
        addAmtA,
        addAmtBDesired,
        addAmtA + 1n, // forces slippage
        0,
        owner.address,
        deadline
      )
    ).to.be.revertedWith("slippage");
  });

  // ---------------------------------------------------------------------------
  // REVERT PATHS: removeLiquidity
  // ---------------------------------------------------------------------------
  it("removeLiquidity reverts due to expired", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const expired = await pastDeadline();
    await expect(
      simpleSwap.removeLiquidity(
        tokenAAddr,
        tokenBAddr,
        1,
        0,
        0,
        ethers.ZeroAddress,
        expired
      )
    ).to.be.revertedWith("expired");
  });

  it("removeLiquidity reverts due to zero_liq", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap.removeLiquidity(
        tokenAAddr,
        tokenBAddr,
        0,
        0,
        0,
        ethers.ZeroAddress,
        deadline
      )
    ).to.be.revertedWith("zero_liq");
  });

  it("removeLiquidity reverts due to insuff_bal (caller without LP)", async function () {
    const { user1, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap
        .connect(user1)
        .removeLiquidity(
          tokenAAddr,
          tokenBAddr,
          1,
          0,
          0,
          user1.address,
          deadline
        )
    ).to.be.revertedWith("insuff_bal");
  });

  it("removeLiquidity reverts due to slippage (min too high)", async function () {
    const { owner, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap.removeLiquidity(
        tokenAAddr,
        tokenBAddr,
        1,
        amountA,
        amountB,
        owner.address,
        deadline
      )
    ).to.be.revertedWith("slippage");
  });

  // ---------------------------------------------------------------------------
  // REVERT PATHS: swapExactTokensForTokens
  // ---------------------------------------------------------------------------
  it("swap reverts due to expired", async function () {
    const {
      user1,
      tokenA,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
    } = await deployTokensAndSwap();
    const amt = 1n;
    await tokenA.transfer(user1.address, amt);
    await tokenA.connect(user1).approve(simpleSwapAddr, amt);
    const expired = await pastDeadline();
    await expect(
      simpleSwap
        .connect(user1)
        .swapExactTokensForTokens(
          amt,
          0,
          [tokenAAddr, tokenBAddr],
          user1.address,
          expired
        )
    ).to.be.revertedWith("expired");
  });

  it("swap reverts due to invalid_path (len !=2)", async function () {
    const {
      user1,
      tokenA,
      tokenB,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
    } = await deployTokensAndSwap();
    const amt = 1n;
    await tokenA.transfer(user1.address, amt);
    await tokenB.transfer(user1.address, amt);
    await tokenA.connect(user1).approve(simpleSwapAddr, amt);
    await tokenB.connect(user1).approve(simpleSwapAddr, amt);
    const deadline = await futureDeadline();
    await expect(
      simpleSwap
        .connect(user1)
        .swapExactTokensForTokens(
          amt,
          0,
          [tokenAAddr, tokenBAddr, tokenAAddr],
          user1.address,
          deadline
        )
    ).to.be.revertedWith("invalid_path");
  });

  it("swap reverts due to invalid_path (identical tokens in path)", async function () {
    const { user1, tokenA, tokenAAddr, simpleSwap, simpleSwapAddr } =
      await deployTokensAndSwap();
    const amt = 1n;
    await tokenA.transfer(user1.address, amt);
    await tokenA.connect(user1).approve(simpleSwapAddr, amt);
    const deadline = await futureDeadline();
    await expect(
      simpleSwap
        .connect(user1)
        .swapExactTokensForTokens(
          amt,
          0,
          [tokenAAddr, tokenAAddr],
          user1.address,
          deadline
        )
    ).to.be.revertedWith("invalid_path");
  });

  it("swap reverts due to zero_input", async function () {
    const { user1, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();
    const deadline = await futureDeadline();
    await expect(
      simpleSwap
        .connect(user1)
        .swapExactTokensForTokens(
          0,
          0,
          [tokenAAddr, tokenBAddr],
          user1.address,
          deadline
        )
    ).to.be.revertedWith("zero_input");
  });

  it("swap reverts due to slippage when amountOut < min", async function () {
    const {
      user1,
      tokenA,
      tokenAAddr,
      tokenBAddr,
      simpleSwap,
      simpleSwapAddr,
    } = await deployTokensAndSwap();
    const amt = ethers.parseUnits("10", DECIMALS);
    await tokenA.transfer(user1.address, amt);
    await tokenA.connect(user1).approve(simpleSwapAddr, amt);
    const deadline = await futureDeadline();
    const tooHighMin = ethers.parseUnits("1000000", DECIMALS);
    await expect(
      simpleSwap
        .connect(user1)
        .swapExactTokensForTokens(
          amt,
          tooHighMin,
          [tokenAAddr, tokenBAddr],
          user1.address,
          deadline
        )
    ).to.be.revertedWith("slippage");
  });

  // ---------------------------------------------------------------------------
  // getPrice() paths
  // ---------------------------------------------------------------------------
  it("getPrice returns price when reserves exist", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const price = await simpleSwap.getPrice(tokenAAddr, tokenBAddr);
    expect(price).to.be.gt(0n);
  });

  it("getPrice reverts zero_resv when inverse pair has no liquidity", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    await expect(
      simpleSwap.getPrice(tokenBAddr, tokenAAddr)
    ).to.be.revertedWith("zero_resv");
  });

  // ---------------------------------------------------------------------------
  // getAmountOut() paths (pure)
  // ---------------------------------------------------------------------------
  describe("getAmountOut (pure) revert paths", function () {
    it("zero_input", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(0, 1, 1)).to.be.revertedWith("zero_input");
    });
    it("bad_resv if reserveIn == 0", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(1, 0, 1)).to.be.revertedWith("bad_resv");
    });
    it("bad_resv if reserveOut == 0", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(1, 1, 0)).to.be.revertedWith("bad_resv");
    });
    it("calculates correctly with reserves >0", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      const out = await lib.getAmountOut(1000, 5000, 5000);
      expect(out).to.equal(833); // (1000*5000)/(5000+1000)=5e6/6000=833
    });
  });
});

// ===========================================================================
// Direct coverage of tokenA and tokenB
// ===========================================================================
describe("TokenA and TokenB direct coverage", function () {
  it("TokenA returns correct decimals and totalSupply", async function () {
    const TokenA = await ethers.getContractFactory("tokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();
    expect(await tokenA.decimals()).to.equal(18);
    const ts = await tokenA.totalSupply();
    expect(ts).to.be.gt(0n);
  });

  it("TokenA transfer + approve + allowance", async function () {
    const [owner, user] = await ethers.getSigners();
    const TokenA = await ethers.getContractFactory("tokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();

    const amount = ethers.parseUnits("10", 18);
    await tokenA.transfer(user.address, amount);
    expect(await tokenA.balanceOf(user.address)).to.equal(amount);

    await tokenA.connect(user).approve(owner.address, amount);
    expect(await tokenA.allowance(user.address, owner.address)).to.equal(
      amount
    );
  });

  it("TokenB transfer + approve + allowance", async function () {
    const [owner, user] = await ethers.getSigners();
    const TokenB = await ethers.getContractFactory("tokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();

    const amount = ethers.parseUnits("5", 18);
    await tokenB.transfer(user.address, amount);
    expect(await tokenB.balanceOf(user.address)).to.equal(amount);

    await tokenB.connect(user).approve(owner.address, amount);
    expect(await tokenB.allowance(user.address, owner.address)).to.equal(
      amount
    );
  });
});
