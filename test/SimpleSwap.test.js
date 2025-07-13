const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleSwap (local)", function () {
  let owner, user1;
  let tokenA, tokenB, simpleSwap;

  beforeEach(async () => {
    [owner, user1] = await ethers.getSigners();

    // Deploy Token A
    const TokenA = await ethers.getContractFactory("tokenA");
    tokenA = await TokenA.deploy();
    await tokenA.waitForDeployment();

    // Deploy Token B
    const TokenB = await ethers.getContractFactory("tokenB");
    tokenB = await TokenB.deploy();
    await tokenB.waitForDeployment();

    // Deploy SimpleSwap
    const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
    simpleSwap = await SimpleSwap.deploy();
    await simpleSwap.waitForDeployment();

    // Mint tokens
    await tokenA.mint(owner.address, ethers.parseUnits("1000", 18));
    await tokenB.mint(owner.address, ethers.parseUnits("1000", 18));

    // Approve tokens for swap
    await tokenA.approve(simpleSwap.getAddress(), ethers.parseUnits("500", 18));
    await tokenB.approve(simpleSwap.getAddress(), ethers.parseUnits("500", 18));

    // Add liquidity with the correct parameters
    const amountADesired = ethers.parseUnits("500", 18);
    const amountBDesired = ethers.parseUnits("500", 18);
    const amountAMin = ethers.parseUnits("100", 18); // Establece el mínimo para tokenA
    const amountBMin = ethers.parseUnits("100", 18); // Establece el mínimo para tokenB
    const to = owner.address; // Dirección a la que se enviarán los tokens de liquidez
    const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600; // Usar `block.timestamp` para un tiempo más confiable

    await simpleSwap.addLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      amountADesired,
      amountBDesired,
      amountAMin,
      amountBMin,
      to,
      deadline
    );
  });

  it("should deploy and set up liquidity correctly", async () => {
    const [reserveA, reserveB] = await simpleSwap.getReserves(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );

    expect(reserveA).to.equal(ethers.parseUnits("500", 18));
    expect(reserveB).to.equal(ethers.parseUnits("500", 18));
  });

  it("should swap token A for B", async () => {
    // Mint tokens to user1
    await tokenA.mint(user1.address, ethers.parseUnits("100", 18));

    // Connect as user1 and approve
    await tokenA.connect(user1).approve(simpleSwap.getAddress(), ethers.parseUnits("100", 18));

    const tokenBBefore = await tokenB.balanceOf(user1.address);

    // Swap A -> B
    await simpleSwap.connect(user1).swapExactTokensForTokens(
      ethers.parseUnits("100", 18),
      ethers.parseUnits("50", 18), // Establecer el valor mínimo que esperas recibir
      [await tokenA.getAddress(), await tokenB.getAddress()],
      user1.address,
      (await ethers.provider.getBlock('latest')).timestamp + 3600 // `deadline` de una hora
    );

    const tokenBAfter = await tokenB.balanceOf(user1.address);
    expect(tokenBAfter).to.be.gt(tokenBBefore);
  });

  it("should return correct price A -> B", async () => {
    const price = await simpleSwap.getPrice(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );
    expect(price).to.be.gt(0);
  });

  it("should remove liquidity", async () => {
    const liquidityAmount = ethers.parseUnits("100", 18); // Liquidez que se va a remover
    const amountAMin = ethers.parseUnits("100", 18); // Establecer el mínimo para tokenA
    const amountBMin = ethers.parseUnits("100", 18); // Establecer el mínimo para tokenB
    const to = owner.address; // Dirección a la que se enviarán los tokens de liquidez
    const deadline = (await ethers.provider.getBlock('latest')).timestamp + 3600; // `deadline` de una hora

    // Remover liquidez
    await simpleSwap.removeLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      liquidityAmount,
      amountAMin,
      amountBMin,
      to,
      deadline
    );

    const [reserveA, reserveB] = await simpleSwap.getReserves(
      await tokenA.getAddress(),
      await tokenB.getAddress()
    );

    expect(reserveA).to.equal(0);
    expect(reserveB).to.equal(0);
  });
});
