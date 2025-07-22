// test/tokens.test.js
const { expect } = require("chai"); // Assertion library
const { ethers } = require("hardhat"); // Ethereum development environment

describe("Token Contracts", function () {
  // Contract factories and instances
  let TokenA, TokenB;
  let tokenA, tokenB;
  
  // Test accounts
  let owner, addr1, addr2;

  // Setup before all tests run
  before(async function () {
    // Get test accounts
    [owner, addr1, addr2] = await ethers.getSigners();
    
    // Get contract factories
    TokenA = await ethers.getContractFactory("tokenA");
    TokenB = await ethers.getContractFactory("tokenB");
    
    // Deploy contracts
    tokenA = await TokenA.deploy();
    tokenB = await TokenB.deploy();
  });

  // Test suite for TokenA
  describe("TokenA", function () {
    // Test ERC20 metadata
    it("Should have correct name and symbol", async function () {
      expect(await tokenA.name()).to.equal("TokenA");
      expect(await tokenA.symbol()).to.equal("TKA");
    });

    // Test initial token distribution
    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await tokenA.balanceOf(owner.address);
      expect(ownerBalance).to.equal(100000000000n * 10n**18n); // 100 billion tokens with 18 decimals
    });

    // Test minting functionality
    it("Should allow owner to mint new tokens", async function () {
      const initialBalance = await tokenA.balanceOf(addr1.address);
      await tokenA.mint(addr1.address, 1000);
      const finalBalance = await tokenA.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(1000);
    });

    // Test ownership restriction
    it("Should NOT allow non-owners to mint tokens", async function () {
      await expect(
        tokenA.connect(addr1).mint(addr2.address, 1000)
      ).to.be.revertedWithCustomError(tokenA, "OwnableUnauthorizedAccount");
    });
  });

  // Test suite for TokenB (similar to TokenA)
  describe("TokenB", function () {
    it("Should have correct name and symbol", async function () {
      expect(await tokenB.name()).to.equal("TokenB");
      expect(await tokenB.symbol()).to.equal("TKB");
    });

    it("Should mint initial supply to owner", async function () {
      const ownerBalance = await tokenB.balanceOf(owner.address);
      expect(ownerBalance).to.equal(100000000000n * 10n**18n);
    });

    it("Should allow owner to mint new tokens", async function () {
      const initialBalance = await tokenB.balanceOf(addr1.address);
      await tokenB.mint(addr1.address, 1000);
      const finalBalance = await tokenB.balanceOf(addr1.address);
      expect(finalBalance - initialBalance).to.equal(1000);
    });

    it("Should NOT allow non-owners to mint tokens", async function () {
      await expect(
        tokenB.connect(addr1).mint(addr2.address, 1000)
      ).to.be.revertedWithCustomError(tokenB, "OwnableUnauthorizedAccount");
    });
  });

  // Test suite for standard ERC20 functionality
  describe("Standard ERC20 Functionality", function () {
    // Reset token balances before each test
    beforeEach(async function () {
      // Clear any existing balances from test accounts
      const balanceA1 = await tokenA.balanceOf(addr1.address);
      const balanceA2 = await tokenA.balanceOf(addr2.address);
      const balanceB1 = await tokenB.balanceOf(addr1.address);
      const balanceB2 = await tokenB.balanceOf(addr2.address);
      
      if (balanceA1 > 0) {
        await tokenA.connect(addr1).transfer(owner.address, balanceA1);
      }
      if (balanceA2 > 0) {
        await tokenA.connect(addr2).transfer(owner.address, balanceA2);
      }
      if (balanceB1 > 0) {
        await tokenB.connect(addr1).transfer(owner.address, balanceB1);
      }
      if (balanceB2 > 0) {
        await tokenB.connect(addr2).transfer(owner.address, balanceB2);
      }
    });

    // Test token transfers
    it("Should transfer tokens between accounts (TokenA)", async function () {
      await tokenA.transfer(addr1.address, 1000);
      const balance = await tokenA.balanceOf(addr1.address);
      expect(balance).to.equal(1000);
    });

    it("Should transfer tokens between accounts (TokenB)", async function () {
      await tokenB.transfer(addr1.address, 1000);
      const balance = await tokenB.balanceOf(addr1.address);
      expect(balance).to.equal(1000);
    });

    // Test insufficient balance scenario
    it("Should fail if sender has insufficient balance (TokenA)", async function () {
      // Verify test account starts with 0 balance
      const initialBalance = await tokenA.balanceOf(addr1.address);
      expect(initialBalance).to.equal(0);
      
      // Attempt transfer without funds
      await expect(
        tokenA.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(tokenA, "ERC20InsufficientBalance");
    });

    // Test approval mechanism
    it("Should update allowance when approving (TokenB)", async function () {
      await tokenB.approve(addr1.address, 1000);
      expect(await tokenB.allowance(owner.address, addr1.address)).to.equal(1000);
    });

    // Test transferFrom functionality
    it("Should transfer from with allowance (TokenA)", async function () {
      // Owner approves addr1 to spend tokens
      await tokenA.approve(addr1.address, 1000);
      
      // Addr1 transfers from owner to addr2
      await tokenA.connect(addr1).transferFrom(owner.address, addr2.address, 500);
      
      // Verify transfer
      expect(await tokenA.balanceOf(addr2.address)).to.equal(500);
    });
  });
});