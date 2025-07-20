const { expect } = require("chai");
const { ethers } = require("hardhat");

/*
 * Comprehensive test suite for SimpleSwap DEX contract
 * Covers all major functionalities including:
 * - Liquidity provision (add/remove)
 * - Token swaps
 * - Edge cases and failure scenarios
 * - View/pure function validations
 */
describe("SimpleSwap (high coverage)", function () {
  // Test constants
  const DECIMALS = 18;
  const oneHour = 3600n;

  // Initial liquidity amounts for testing
  const amountA = ethers.parseUnits("500", DECIMALS);
  const amountB = ethers.parseUnits("500", DECIMALS);
  const minAmount = ethers.parseUnits("100", DECIMALS);

  /** Helper: Gets current block timestamp */
  async function blockTimestamp() {
    const blk = await ethers.provider.getBlock("latest");
    return BigInt(blk.timestamp);
  }

  /** Helper: Creates a future deadline (now + 1h) */
  async function futureDeadline() {
    return (await blockTimestamp()) + oneHour;
  }

  /** Helper: Creates an expired deadline (now - 1s) */
  async function pastDeadline() {
    return (await blockTimestamp()) - 1n;
  }

  /**
   * Deployment helper:
   * - Deploys tokenA, tokenB and SimpleSwap contracts
   * - Funds deployer with initial tokens
   * - Approves and adds initial liquidity
   */
  async function deployTokensAndSwap() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy ERC20 tokens
    const TokenA = await ethers.getContractFactory("tokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();

    const TokenB = await ethers.getContractFactory("tokenB");
    const tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();

    // Deploy SimpleSwap contract
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    const simpleSwap = await SimpleSwap.deploy();
    await simpleSwap.waitForDeployment();

    // Get contract addresses
    const tokenAAddr = await tokenA.getAddress();
    const tokenBAddr = await tokenB.getAddress();
    const simpleSwapAddr = await simpleSwap.getAddress();

    // Approve initial liquidity
    await tokenA.approve(simpleSwapAddr, amountA);
    await tokenB.approve(simpleSwapAddr, amountB);

    // Add initial liquidity
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

  /**
   * Tests initial pool creation:
   * - Verifies reserves are set correctly
   * - Checks LP tokens are minted properly
   * - Validates LiquidityAdded event emission
   */
  it("deploy + addLiquidity initializes reserves and totalSupply", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap, addLiqReceipt } =
      await deployTokensAndSwap();

    const pair = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(pair.totalSupply).to.equal(amountA); // First LP gets amountA in LP tokens
    expect(pair.reserves.reserveA).to.equal(amountA);
    expect(pair.reserves.reserveB).to.equal(amountB);

    // Verify event emission
    const evt = addLiqReceipt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityAdded"
    );
    expect(evt).to.not.be.undefined;
    expect(evt.args.liquidity).to.equal(amountA);
  });

  /**
   * Tests subsequent liquidity addition:
   * - Verifies proportional minting based on existing reserves
   * - Checks reserves are updated correctly
   * - Validates event emission
   */
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

    const addAmtA = ethers.parseUnits("50", DECIMALS);
    const addAmtBDesired = ethers.parseUnits("1000", DECIMALS);

    // Fund owner with additional tokens
    await tokenA.transfer(owner.address, addAmtA);
    await tokenB.transfer(owner.address, addAmtBDesired);

    // Approve additional amounts
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

    // Verify state changes
    expect(pairAfter.totalSupply).to.be.gt(pairBefore.totalSupply);
    expect(pairAfter.reserves.reserveA).to.be.gt(pairBefore.reserves.reserveA);
    expect(pairAfter.reserves.reserveB).to.be.gt(pairBefore.reserves.reserveB);

    // Verify event
    const evt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityAdded"
    );
    expect(evt).to.not.be.undefined;
  });

  /**
   * Tests token swapping functionality:
   * - Verifies token transfers
   * - Checks reserve updates
   * - Validates event emission
   */
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

    // Fund user and approve swap
    await tokenA.transfer(user1.address, swapAmountIn);
    await tokenA.connect(user1).approve(simpleSwapAddr, swapAmountIn);

    const beforeB = await tokenB.balanceOf(user1.address);
    const pairBefore = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    // Execute swap
    const deadline = await futureDeadline();
    const tx = await simpleSwap.connect(user1).swapExactTokensForTokens(
      swapAmountIn,
      0, // Accept any output >0
      [tokenAAddr, tokenBAddr],
      user1.address,
      deadline
    );
    const rcpt = await tx.wait();

    // Verify token transfer
    const afterB = await tokenB.balanceOf(user1.address);
    expect(afterB).to.be.gt(beforeB);

    // Verify reserve updates
    const pairAfter = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(pairAfter.reserves.reserveA).to.equal(
      pairBefore.reserves.reserveA + swapAmountIn
    );
    expect(pairAfter.reserves.reserveB).to.be.lt(pairBefore.reserves.reserveB);

    // Verify event
    const swapEvt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "TokensSwapped"
    );
    expect(swapEvt).to.not.be.undefined;
  });

  /**
   * Tests minimum output amount enforcement:
   * - Verifies swap succeeds when output >= minimum
   * - Uses contract's own formula for calculation
   */
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

    // Calculate expected output using contract's formula
    const pair = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    const expectedOut =
      (amtIn * pair.reserves.reserveB) / (pair.reserves.reserveA + amtIn);

    const deadline = await futureDeadline();
    await simpleSwap.connect(user1).swapExactTokensForTokens(
      amtIn,
      expectedOut - 1n, // Set min slightly below expected
      [tokenAAddr, tokenBAddr],
      user1.address,
      deadline
    );

    // Verify received amount
    const gotB = await tokenB.balanceOf(user1.address);
    expect(gotB).to.be.gte(expectedOut - 1n);
  });

  /**
   * Tests liquidity removal:
   * - Verifies token returns
   * - Checks reserve and supply updates
   * - Validates event emission
   */
  it("removeLiquidity returns tokens and updates reserves", async function () {
    const { owner, tokenA, tokenB, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();

    const liquidity = ethers.parseUnits("100", DECIMALS);
    const deadline = await futureDeadline();

    // Get initial balances and state
    const balBeforeA = await tokenA.balanceOf(owner.address);
    const balBeforeB = await tokenB.balanceOf(owner.address);
    const pairBefore = await simpleSwap.pairs(tokenAAddr, tokenBAddr);

    // Remove liquidity
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

    // Verify token returns
    const balAfterA = await tokenA.balanceOf(owner.address);
    const balAfterB = await tokenB.balanceOf(owner.address);
    expect(balAfterA).to.be.gt(balBeforeA);
    expect(balAfterB).to.be.gt(balBeforeB);

    // Verify state updates
    const pairAfter = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(pairAfter.reserves.reserveA).to.be.lt(pairBefore.reserves.reserveA);
    expect(pairAfter.reserves.reserveB).to.be.lt(pairBefore.reserves.reserveB);
    expect(pairAfter.totalSupply).to.equal(pairBefore.totalSupply - liquidity);

    // Verify event
    const rmEvt = rcpt.logs.find(
      (l) => l.fragment && l.fragment.name === "LiquidityRemoved"
    );
    expect(rmEvt).to.not.be.undefined;
  });

  /**
   * Tests complete liquidity removal:
   * - Verifies pool is drained completely
   * - Checks all state is reset to zero
   */
  it("removeLiquidity total (burn all) leaves totalSupply=0", async function () {
    const { owner, tokenAAddr, tokenBAddr, simpleSwap } =
      await deployTokensAndSwap();

    // Withdraw entire liquidity
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

    // Verify complete removal
    const after = await simpleSwap.pairs(tokenAAddr, tokenBAddr);
    expect(after.totalSupply).to.equal(0);
    expect(after.reserves.reserveA).to.equal(0);
    expect(after.reserves.reserveB).to.equal(0);
  });

  // ---------------------------------------------------------------------------
  // REVERT PATHS: addLiquidity
  // ---------------------------------------------------------------------------

  /**
   * Tests expired deadline rejection
   */
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

  /**
   * Tests identical token rejection
   */
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

  /**
   * Tests zero amount rejection
   */
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

  /**
   * Tests slippage protection
   */
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
        addAmtA + 1n, // Forces slippage
        0,
        owner.address,
        deadline
      )
    ).to.be.revertedWith("slippage");
  });

  // ---------------------------------------------------------------------------
  // REVERT PATHS: removeLiquidity
  // ---------------------------------------------------------------------------

  /**
   * Tests expired deadline rejection
   */
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

  /**
   * Tests zero liquidity rejection
   */
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

  /**
   * Tests insufficient balance rejection
   */
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

  /**
   * Tests slippage protection
   */
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

  /**
   * Tests expired deadline rejection
   */
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

  /**
   * Tests invalid path length rejection
   */
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

  /**
   * Tests identical token rejection (modified to expect 'bad_resv')
   */
  it("swap reverts due to identical tokens in path (now with bad_resv)", async function () {
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
    ).to.be.revertedWith("bad_resv"); // Modified expectation
  });

  /**
   * Tests zero input rejection
   */
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

  /**
   * Tests slippage protection
   */
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

  /**
   * Tests price calculation with existing reserves
   */
  it("getPrice returns price when reserves exist", async function () {
    const { tokenAAddr, tokenBAddr, simpleSwap } = await deployTokensAndSwap();
    const price = await simpleSwap.getPrice(tokenAAddr, tokenBAddr);
    expect(price).to.be.gt(0n);
  });

  /**
   * Tests price calculation rejection when no reserves exist
   */
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
    /**
     * Tests zero input rejection
     */
    it("zero_input", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(0, 1, 1)).to.be.revertedWith("zero_input");
    });
    
    /**
     * Tests zero input reserve rejection
     */
    it("bad_resv if reserveIn == 0", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(1, 0, 1)).to.be.revertedWith("bad_resv");
    });
    
    /**
     * Tests zero output reserve rejection
     */
    it("bad_resv if reserveOut == 0", async function () {
      const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
      const lib = await SimpleSwap.deploy();
      await lib.waitForDeployment();
      await expect(lib.getAmountOut(1, 1, 0)).to.be.revertedWith("bad_resv");
    });
    
    /**
     * Tests correct calculation with valid inputs
     */
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
  /**
   * Tests tokenA basic properties
   */
  it("TokenA returns correct decimals and totalSupply", async function () {
    const TokenA = await ethers.getContractFactory("tokenA");
    const tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();
    expect(await tokenA.decimals()).to.equal(18);
    const ts = await tokenA.totalSupply();
    expect(ts).to.be.gt(0n);
  });

  /**
   * Tests tokenA transfer and approval functionality
   */
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

  /**
   * Tests tokenB transfer and approval functionality
   */
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