// File: @openzeppelin/contracts/token/ERC20/IERC20.sol

// OpenZeppelin Contracts (last updated v5.1.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.20;

/**
 * @dev Interface of the ERC-20 standard as defined in the ERC.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    /**
     * @dev Returns the value of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the value of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves a `value` amount of tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 value) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    /**
     * @dev Sets a `value` amount of tokens as the allowance of `spender` over the
     * caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 value) external returns (bool);

    /**
     * @dev Moves a `value` amount of tokens from `from` to `to` using the
     * allowance mechanism. `value` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}

// File: @openzeppelin/contracts/security/ReentrancyGuard.sol

// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}

// File: Contratos_2025/Swap/Simple.sol

pragma solidity ^0.8.20;

/// @title SimpleSwap - Decentralized Exchange Contract
/// @notice Allows adding/removing liquidity and swapping tokens
contract SimpleSwap is ReentrancyGuard {
    struct Reserves {
        uint128 reserveA;
        uint128 reserveB;
    }

    struct LiquidityData {
        uint totalSupply;
        mapping(address => uint) balance;
        Reserves reserves;
    }

    /// @dev Maps token pairs to their liquidity data
    mapping(address => mapping(address => LiquidityData)) public pairs;

    /// @notice Emitted when liquidity is added to a token pair
    /// @param tokenA The first token of the pair
    /// @param tokenB The second token of the pair
    /// @param provider The address providing liquidity
    /// @param amountA Amount of tokenA added
    /// @param amountB Amount of tokenB added
    /// @param liquidity Liquidity tokens minted
    event LiquidityAdded(
        address indexed tokenA,
        address indexed tokenB,
        address indexed provider,
        uint amountA,
        uint amountB,
        uint liquidity
    );

    /// @notice Emitted when liquidity is removed from a token pair
    /// @param tokenA The first token of the pair
    /// @param tokenB The second token of the pair
    /// @param provider The address removing liquidity
    /// @param amountA Amount of tokenA returned
    /// @param amountB Amount of tokenB returned
    /// @param liquidity Liquidity tokens burned
    event LiquidityRemoved(
        address indexed tokenA,
        address indexed tokenB,
        address indexed provider,
        uint amountA,
        uint amountB,
        uint liquidity
    );

    /// @notice Emitted when a token swap is executed
    /// @param tokenIn Token sent by the user
    /// @param tokenOut Token received by the user
    /// @param trader The address performing the swap
    /// @param amountIn Input token amount
    /// @param amountOut Output token amount
    event TokensSwapped(
        address indexed tokenIn,
        address indexed tokenOut,
        address indexed trader,
        uint amountIn,
        uint amountOut
    );

    /// @notice Adds liquidity to a token pair
    /// @dev Transfers the desired amounts to the contract and mints liquidity
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @param amountADesired Desired amount of token A
    /// @param amountBDesired Desired amount of token B
    /// @param amountAMin Minimum amount of token A accepted
    /// @param amountBMin Minimum amount of token B accepted
    /// @param to Address to receive liquidity tokens
    /// @param deadline Timestamp after which the transaction is invalid
    /// @return amountA Actual amount of token A added
    /// @return amountB Actual amount of token B added
    /// @return liquidity Liquidity tokens minted
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    )
        external
        nonReentrant
        returns (uint amountA, uint amountB, uint liquidity)
    {
        require(block.timestamp <= deadline, "expired");
        require(tokenA != tokenB, "identical");
        require(amountADesired > 0 && amountBDesired > 0, "invalid_amt");

        IERC20(tokenA).transferFrom(msg.sender, address(this), amountADesired);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountBDesired);

        LiquidityData storage pair = pairs[tokenA][tokenB];
        uint128 reserveA = pair.reserves.reserveA;
        uint128 reserveB = pair.reserves.reserveB;

        amountA = amountADesired;
        amountB = (reserveA == 0)
            ? amountBDesired
            : (amountADesired * reserveB) / reserveA;

        require(amountA >= amountAMin && amountB >= amountBMin, "slippage");

        liquidity = (reserveA == 0)
            ? amountA
            : (amountA * pair.totalSupply) / reserveA;

        pair.reserves.reserveA += uint128(amountA);
        pair.reserves.reserveB += uint128(amountB);
        pair.totalSupply += liquidity;
        pair.balance[to] += liquidity;

        emit LiquidityAdded(tokenA, tokenB, to, amountA, amountB, liquidity);
    }

    /// @notice Removes liquidity from a token pair
    /// @param tokenA Address of token A
    /// @param tokenB Address of token B
    /// @param liquidity Amount of liquidity tokens to burn
    /// @param amountAMin Minimum amount of token A expected
    /// @param amountBMin Minimum amount of token B expected
    /// @param to Address to receive withdrawn tokens
    /// @param deadline Timestamp after which the transaction is invalid
    /// @return amountA Actual amount of token A returned
    /// @return amountB Actual amount of token B returned
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external nonReentrant returns (uint amountA, uint amountB) {
        require(block.timestamp <= deadline, "expired");
        require(liquidity > 0, "zero_liq");

        LiquidityData storage pair = pairs[tokenA][tokenB];
        require(pair.balance[msg.sender] >= liquidity, "insuff_bal");

        uint128 reserveA = pair.reserves.reserveA;
        uint128 reserveB = pair.reserves.reserveB;

        amountA = (liquidity * reserveA) / pair.totalSupply;
        amountB = (liquidity * reserveB) / pair.totalSupply;

        require(amountA >= amountAMin && amountB >= amountBMin, "slippage");

        pair.reserves.reserveA -= uint128(amountA);
        pair.reserves.reserveB -= uint128(amountB);
        pair.totalSupply -= liquidity;
        pair.balance[msg.sender] -= liquidity;

        IERC20(tokenA).transfer(to, amountA);
        IERC20(tokenB).transfer(to, amountB);

        emit LiquidityRemoved(
            tokenA,
            tokenB,
            msg.sender,
            amountA,
            amountB,
            liquidity
        );
    }

    /// @notice Swaps a fixed amount of tokens for another token
    /// @param amountIn Input amount of tokenIn
    /// @param amountOutMin Minimum output amount of tokenOut
    /// @param path Array with [tokenIn, tokenOut]
    /// @param to Recipient of tokenOut
    /// @param deadline Transaction deadline
    /// @return amounts Array with [amountIn, amountOut]
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external nonReentrant returns (uint[] memory amounts) {
        require(block.timestamp <= deadline, "expired");
        require(path.length == 2, "invalid_path");
        require(amountIn > 0, "zero_input");

        address tokenIn = path[0];
        address tokenOut = path[1];

        LiquidityData storage pair = pairs[tokenIn][tokenOut];

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        uint amountOut = getAmountOut(
            amountIn,
            pair.reserves.reserveA,
            pair.reserves.reserveB
        );
        require(amountOut >= amountOutMin, "slippage");

        pair.reserves.reserveA += uint128(amountIn);
        pair.reserves.reserveB -= uint128(amountOut);

        IERC20(tokenOut).transfer(to, amountOut);

        amounts = new uint[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;

        emit TokensSwapped(tokenIn, tokenOut, msg.sender, amountIn, amountOut);
    }

    /// @notice Returns the price of tokenA in terms of tokenB
    /// @param tokenA The base token
    /// @param tokenB The quote token
    /// @return price TokenA/TokenB price (scaled by 1e18)
    function getPrice(
        address tokenA,
        address tokenB
    ) external view returns (uint price) {
        Reserves memory reserves = pairs[tokenA][tokenB].reserves;
        require(reserves.reserveA > 0 && reserves.reserveB > 0, "zero_resv");
        price = (uint(reserves.reserveA) * 1e18) / reserves.reserveB;
    }

    /// @notice Calculates output amount for a given input amount and reserves
    /// @param amountIn Input token amount
    /// @param reserveIn Reserve of input token
    /// @param reserveOut Reserve of output token
    /// @return amountOut Output token amount
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) public pure returns (uint amountOut) {
        require(amountIn > 0, "zero_input");
        require(reserveIn > 0 && reserveOut > 0, "bad_resv");

        amountOut = (amountIn * reserveOut) / (reserveIn + amountIn);
    }
}
