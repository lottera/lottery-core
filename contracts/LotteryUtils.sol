// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UniswapV2Library.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";

library LotteryUtils {
    // Libraries
    // Safe math
    using SafeMathUpgradeable for uint256;

    struct Set {
        uint16[] values;
        mapping(uint16 => bool) isExists;
    }

    // Represents the status of the lottery
    enum Status {
        Open, // The lottery is open for ticket purchases
        Closed, // The lottery is no closed for new round
        RewardCompleted // The lottery reward has been calculated
    }

    struct GamblingInfo {
        address gambler;
        uint16 lotteryNumber;
        uint256 amount;
        uint256 rewardMultiplier;
    }

    // All the needed info around a lottery
    struct LotteryInfo {
        uint256 lotteryId; // ID for lotto
        Status lotteryStatus; // Status for lotto
        mapping(uint16 => GamblingInfo[]) lottoGamblerByNumber; // Mapping of lotteryNumber -> array of GamblingInfo
        mapping(address => GamblingInfo[]) lottoGamblerByAddress; // Mapping of gambler's address -> array of GamblingInfo
        mapping(uint16 => uint256) totalAmountByNumber; // Mapping of lotteryNumber -> total amount
        mapping(uint16 => uint256) totalRewardAmountByNumber; // Mapping of lotteryNumber -> total reward amount
        uint256 totalAmount; // Total bet amount
        Set winningNumbers; // Two digit winning
        uint256 lockedStableAmount; // Stable coin amount that was locked
    }

    uint256 internal constant Q = 1 * (10**8);

    function getLottoStablePairInfo(
        address _factory,
        address _stable,
        address _lotto
    )
        public
        view
        returns (
            uint256 reserveStable,
            uint256 reserveLotto,
            uint256 totalSupply
        )
    {
        IUniswapV2Pair _pair = IUniswapV2Pair(
            UniswapV2Library.pairFor(_factory, _stable, _lotto)
        );
        totalSupply = _pair.totalSupply();
        (uint256 reserves0, uint256 reserves1, ) = _pair.getReserves();
        (reserveStable, reserveLotto) = _stable == _pair.token0()
            ? (reserves0, reserves1)
            : (reserves1, reserves0);
    }

    function getStableOutputWithDirectPrice(
        uint256 _lottoAmount,
        address _factory,
        address _stable,
        address _lotto
    ) internal view returns (uint256 stableOutput) {
        (
            uint256 reserveStable,
            uint256 reserveLotto,

        ) = getLottoStablePairInfo(_factory, _stable, _lotto);
        stableOutput = reserveStable.mul(_lottoAmount).div(reserveLotto);
    }

    function getLottoOutputWithDirectPrice(
        uint256 _stableAmount,
        address _factory,
        address _stable,
        address _lotto
    ) internal view returns (uint256 lottoOutput) {
        (
            uint256 reserveStable,
            uint256 reserveLotto,

        ) = getLottoStablePairInfo(_factory, _stable, _lotto);
        lottoOutput = reserveLotto.mul(_stableAmount).div(reserveStable);
    }

    function getRequiredStableForExpectedLotto(
        uint256 _expectedLotto,
        address _factory,
        address _stable,
        address _lotto
    ) internal view returns (uint256 requiredStable) {
        (
            uint256 reserveStable,
            uint256 reserveLotto,

        ) = getLottoStablePairInfo(_factory, _stable, _lotto);
        require(_expectedLotto < reserveLotto, "Insufficient lotto in lp");
        requiredStable = UniswapV2Library.getAmountIn(
            _expectedLotto,
            reserveStable,
            reserveLotto
        );
    }

    function getPossibleStableOutputForInputLotto(
        uint256 _lottoAmount,
        address _factory,
        address _stable,
        address _lotto
    ) internal view returns (uint256 stableOutput) {
        (
            uint256 reserveStable,
            uint256 reserveLotto,

        ) = getLottoStablePairInfo(_factory, _stable, _lotto);
        stableOutput = UniswapV2Library.getAmountOut(
            _lottoAmount,
            reserveLotto,
            reserveStable
        );
    }

    function getPossibleLottoOutputForInputStable(
        uint256 _stableAmount,
        address _factory,
        address _stable,
        address _lotto
    ) internal view returns (uint256 lottoOutput) {
        (
            uint256 reserveStable,
            uint256 reserveLotto,

        ) = getLottoStablePairInfo(_factory, _stable, _lotto);
        lottoOutput = UniswapV2Library.getAmountOut(
            _stableAmount,
            reserveStable,
            reserveLotto
        );
    }

    function getRemainingPoolAmount(
        uint256 _currentStakedStableAmount,
        uint256 _currentBetAmount,
        uint256 _currentTotalBetAmount,
        uint256 _totalLotteryNumber
    ) internal pure returns (uint256 remainingPoolAmount) {
        uint256 currentPoolAmount = _currentStakedStableAmount.div(
            _totalLotteryNumber
        );
        require(
            currentPoolAmount > 0,
            "Staked stable amount should be greater than zero"
        );
        require(
            _currentBetAmount <= currentPoolAmount,
            "Invalid current bet amount greater than pool amount"
        );
        uint256 averageBetAmount = _currentTotalBetAmount.div(
            _totalLotteryNumber
        );
        if (_currentBetAmount > averageBetAmount) {
            uint256 diffAmount = _currentBetAmount.sub(averageBetAmount);
            remainingPoolAmount = currentPoolAmount.sub(diffAmount);
        } else {
            uint256 diffAmount = averageBetAmount.sub(_currentBetAmount);
            remainingPoolAmount = currentPoolAmount.add(diffAmount);
        }
    }

    function getRewardMultiplier(
        uint256 _currentStakedStableAmount,
        uint256 _currentBetAmount,
        uint256 _currentTotalBetAmount,
        uint256 _totalLotteryNumber,
        uint256 _maxRewardMultiplier
    ) internal pure returns (uint256 multiplier) {
        uint256 currentPoolAmount = _currentStakedStableAmount.div(
            _totalLotteryNumber
        );
        uint256 remainingPoolAmount = getRemainingPoolAmount(
            _currentStakedStableAmount,
            _currentBetAmount,
            _currentTotalBetAmount,
            _totalLotteryNumber
        );

        multiplier = remainingPoolAmount.mul(_maxRewardMultiplier).div(
            currentPoolAmount
        );
    }

    function getMaxAllowBetAmount(
        uint256 _currentStakedStableAmount,
        uint256 _currentBetAmount,
        uint256 _currentTotalBetAmount,
        uint256 _totalLotteryNumber,
        uint256 _maxRewardMultiplier,
        uint256 _maxMultiplierSlippageTolerancePercentage
    ) internal pure returns (uint256 maxAllowBetAmount) {
        uint256 remainingPoolAmount = getRemainingPoolAmount(
            _currentStakedStableAmount,
            _currentBetAmount,
            _currentTotalBetAmount,
            _totalLotteryNumber
        );
        uint256 currentMultiplierQ = getRewardMultiplier(
            _currentStakedStableAmount,
            _currentBetAmount,
            _currentTotalBetAmount,
            _totalLotteryNumber,
            _maxRewardMultiplier
        ).mul(Q);
        uint256 maxMultiplierSlippageToleranceAmountQ = _maxMultiplierSlippageTolerancePercentage
                .mul(currentMultiplierQ)
                .div(100);
        uint256 targetMultiplierQ = currentMultiplierQ -
            maxMultiplierSlippageToleranceAmountQ;
        maxAllowBetAmount =
            remainingPoolAmount -
            targetMultiplierQ.mul(remainingPoolAmount).div(currentMultiplierQ);
    }
}
