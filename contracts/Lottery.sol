// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./LotteryUtils.sol";
import "./interface/ILotteryFactory.sol";

contract Lottery is Ownable {
    // Libraries
    // Safe math
    using SafeMath for uint256;

    // Safe ERC20
    using SafeERC20 for IERC20;

    // Address functionality
    using Address for address;

    // Counter for lottery IDs
    uint256 private lotteryIdCounter_;

    IERC20 internal lotto_;
    address internal lottoAddress_;

    IERC20 internal stable_;
    address internal stableAddress_;

    IUniswapV2Router02 internal uniswapRouter_;

    ILotteryFactory internal lotteryFactory_;

    // Address for uniswap v2 factory
    address factory_;

    struct BuyLotteryInfo {
        uint16 lotteryNumber;
        uint256 amount;
    }

    // Lottery ID's to info
    mapping(uint256 => LotteryUtils.LotteryInfo) internal allLotteries_;
    // Max reward multiplier
    uint256 internal maxRewardMultiplier_;
    // Max multiplier slippage tolerance / max percentage that allow reward multiplier to be changed
    uint256 internal maxMultiplierSlippageTolerancePercentage_;
    // Total lottery number (100 for 2 digits / 1000 for 3 digits)
    uint16 internal totalLotteryNumber_;
    // Number of winning number
    uint8 internal totalWinningNumber_;
    // Mapping of banker's staked amount
    mapping(address => uint256) internal stableBanker_;
    // Total Staked Amount
    uint256 internal totalStakedStableAmount_;
    // Current Staked Amount
    uint256 internal currentStakedStableAmount_;
    // Mapping of gambler's reward in lotto token
    mapping(address => uint256) internal gamblerReward_;
    // Wei with 18 Decimals
    uint256 internal constant WEI = 1 * (10**18);
    // fee keeper
    address internal feeKeeper_;
    // fee percentage
    uint256 internal feePercentage_;

    //-------------------------------------------------------------------------
    // CONSTRUCTOR
    //-------------------------------------------------------------------------
    constructor(
        address _lotto,
        address _stable,
        address _factory,
        address _router,
        address _lotteryFactory,
        uint256 _maxRewardMultiplier,
        uint16 _totalLotteryNumber,
        uint256 _maxMultiplierSlippageTolerancePercentage,
        uint8 _totalWinningNumber,
        uint256 _feePercentage
    ) {
        lotto_ = IERC20(_lotto);
        lottoAddress_ = _lotto;
        stable_ = IERC20(_stable);
        stableAddress_ = _stable;
        factory_ = _factory;
        uniswapRouter_ = IUniswapV2Router02(_router);
        lotteryFactory_ = ILotteryFactory(_lotteryFactory);
        maxRewardMultiplier_ = _maxRewardMultiplier;
        maxMultiplierSlippageTolerancePercentage_ = _maxMultiplierSlippageTolerancePercentage;
        totalLotteryNumber_ = _totalLotteryNumber;
        lotteryIdCounter_ = 0;
        allLotteries_[lotteryIdCounter_].lotteryStatus = LotteryUtils
            .Status
            .Open;
        totalWinningNumber_ = _totalWinningNumber;
        feeKeeper_ = msg.sender;
        feePercentage_ = _feePercentage;
    }

    //-------------------------------------------------------------------------
    // MODIFIERS
    //-------------------------------------------------------------------------

    modifier notContract() {
        require(!address(msg.sender).isContract(), "contract not allowed");
        require(msg.sender == tx.origin, "proxy contract not allowed");
        _;
    }

    //-------------------------------------------------------------------------
    // EVENTS
    //-------------------------------------------------------------------------

    event StakeStableCoin(
        address indexed banker,
        uint256 amount,
        uint256 total
    );

    event UnstakeStableCoin(
        address indexed banker,
        uint256 actualStakedAmount,
        uint256 amountWithReward,
        uint256 remaining
    );

    event BuyLottery(
        address indexed gambler,
        uint16 lotteryNumber,
        uint256 amount,
        uint256 lotteryId
    );

    event NewRoundLottery(address indexed owner, uint256 newLotteryId);

    event CloseLottery(address indexed owner, uint256 lotteryId);
    event ReopenLottery(address indexed owner, uint256 lotteryId);

    event SetWinningNumbers(
        address indexed owner,
        uint256 lotteryId,
        uint16[] numbers,
        uint16 totalLotteryNumber
    );

    event Debug(string message, uint256 value);

    //-------------------------------------------------------------------------
    // VIEW FUNCTIONS
    //-------------------------------------------------------------------------

    function getBankerStableStakedAmount(address _banker)
        external
        view
        returns (uint256 amount)
    {
        amount = _getBankerCurrentStableAmount(_banker);
    }

    function getAllGamblingInfo(address _gambler)
        external
        view
        returns (LotteryUtils.GamblingInfo[] memory allGamblingInfo)
    {
        allGamblingInfo = allLotteries_[lotteryIdCounter_]
            .lottoGamblerByAddress[_gambler];
    }

    function getWinningNumbers()
        external
        view
        returns (uint16[] memory winningNumbers)
    {
        winningNumbers = allLotteries_[lotteryIdCounter_].winningNumbers.values;
    }

    function getRewardMultiplier(uint16 _number)
        external
        view
        returns (uint256 multiplier)
    {
        uint256 currentBetAmount = allLotteries_[lotteryIdCounter_]
            .totalAmountByNumber[_number];
        multiplier = LotteryUtils.getRewardMultiplier(
            currentStakedStableAmount_,
            currentBetAmount,
            allLotteries_[lotteryIdCounter_].totalAmount,
            totalLotteryNumber_,
            maxRewardMultiplier_
        );
    }

    function getMaxAllowBetAmount(uint16 _number)
        external
        view
        returns (uint256 maxAllowBetAmount)
    {
        uint256 currentBetAmount = allLotteries_[lotteryIdCounter_]
            .totalAmountByNumber[_number];
        maxAllowBetAmount = LotteryUtils.getMaxAllowBetAmount(
            currentStakedStableAmount_,
            currentBetAmount,
            allLotteries_[lotteryIdCounter_].totalAmount,
            totalLotteryNumber_,
            maxRewardMultiplier_,
            maxMultiplierSlippageTolerancePercentage_
        );
    }

    function getLockedStableAmount()
        external
        view
        returns (uint256 lockedStableAmount)
    {
        lockedStableAmount = allLotteries_[lotteryIdCounter_]
            .lockedStableAmount;
    }

    function getLockedStablePercentage()
        external
        view
        returns (uint256 lockedStablePercentage)
    {
        lockedStablePercentage = allLotteries_[lotteryIdCounter_]
            .lockedStableAmount
            .mul(100)
            .mul(WEI)
            .div(currentStakedStableAmount_);
    }

    function getClaimableReward(address _gambler)
        external
        view
        returns (uint256 claimableReward)
    {
        claimableReward = gamblerReward_[_gambler];
    }

    //-------------------------------------------------------------------------
    // General Access Functions
    //-------------------------------------------------------------------------

    function stakeStable(uint256 _amount) external notContract {
        require(_amount > 0, "Stake amount should be more than 0");

        // Transfer stable to contract
        stable_.safeTransferFrom(msg.sender, address(this), _amount);
        // find actual staked shared for banker
        uint256 actualStakedShare = _getActualStakedShareForAmount(_amount);
        // Add staked amount for banker to state
        stableBanker_[msg.sender] += actualStakedShare;
        totalStakedStableAmount_ += actualStakedShare;
        currentStakedStableAmount_ += _amount;
        // Emit StakeStableCoin event
        emit StakeStableCoin(msg.sender, _amount, stableBanker_[msg.sender]);
    }

    function unstakeStable(uint256 _amount) external notContract {
        require(
            _amount <= _getBankerCurrentStableAmount(msg.sender),
            "Unstake amount cannot more than staked amount"
        );
        uint256 lockedStableAmount = allLotteries_[lotteryIdCounter_]
            .lockedStableAmount;
        uint256 unlockedStableAmount = currentStakedStableAmount_ -
            lockedStableAmount;
        uint256 availableToUnstake = unlockedStableAmount
            .mul(stableBanker_[msg.sender])
            .div(currentStakedStableAmount_);

        require(
            _amount <= availableToUnstake,
            "Cannot unstake more than unlocked amount"
        );

        // Transfer stable to banker
        stable_.safeTransfer(msg.sender, _amount);
        // Adjust staked amount for banker to state
        // find actual staked amount to unstake
        uint256 actualStakedShare = _getActualStakedShareForAmount(_amount);
        
        stableBanker_[msg.sender] -= actualStakedShare;
        totalStakedStableAmount_ -= actualStakedShare;
        currentStakedStableAmount_ -= _amount;
        // Emit UnstakeStableCoin event
        emit UnstakeStableCoin(
            msg.sender,
            actualStakedShare,
            _amount,
            stableBanker_[msg.sender]
        );
    }

    function buyLotteries(BuyLotteryInfo[] calldata _lotteries)
        external
        notContract
    {
        require(
            allLotteries_[lotteryIdCounter_].lotteryStatus ==
                LotteryUtils.Status.Open,
            "Current lottery should be Status.Open"
        );
        // Looping for each lottery info
        uint256 totalAmount = 0;
        for (uint16 index = 0; index < _lotteries.length; index++) {
            totalAmount += _buyLottery(_lotteries[index]);
        }

        // Transfer stable to contract
        stable_.safeTransferFrom(msg.sender, address(this), totalAmount);
    }

    function claimReward() external notContract {
        uint256 claimableReward = gamblerReward_[msg.sender];
        require(claimableReward > 0, "No claimable reward");
        stable_.safeTransfer(msg.sender, claimableReward);
        gamblerReward_[msg.sender] = 0;
    }

    //-------------------------------------------------------------------------
    // STATE MODIFYING FUNCTIONS
    // Restricted Access Functions (onlyOwner)
    //-------------------------------------------------------------------------
    function setFeeKeeperAddress(address _newAddress) external onlyOwner {
        feeKeeper_ = _newAddress;
    }

    function setMaxMultiplierSlippageTolerancePercentage(
        uint256 _maxMultiplierSlippageTolerancePercentage
    ) external onlyOwner {
        require(
            _maxMultiplierSlippageTolerancePercentage <= 100,
            "Invalid percentage"
        );
        maxMultiplierSlippageTolerancePercentage_ = _maxMultiplierSlippageTolerancePercentage;
    }

    function setFeePercentage(uint256 _newPercentage) external onlyOwner {
        require(_newPercentage <= 100, "Invalid percentage");
        feePercentage_ = _newPercentage;
    }

    function adjustMaxRewardMultiplier(uint256 _maxRewardMultiplier)
        external
        onlyOwner
    {
        maxRewardMultiplier_ = _maxRewardMultiplier;
    }

    function adjustTotalWinningNumber(uint8 _totalWinningNumber)
        external
        onlyOwner
    {
        totalWinningNumber_ = _totalWinningNumber;
    }

    function closeLottery() external onlyOwner {
        require(
            allLotteries_[lotteryIdCounter_].lotteryStatus ==
                LotteryUtils.Status.Open,
            "Current lottery should be Status.Open"
        );
        allLotteries_[lotteryIdCounter_].lotteryStatus = LotteryUtils
            .Status
            .Closed;
        emit CloseLottery(msg.sender, lotteryIdCounter_);
    }

    function reopenLottery() external onlyOwner {
        require(
            allLotteries_[lotteryIdCounter_].lotteryStatus ==
                LotteryUtils.Status.Closed,
            "Current lottery should be Status.Closed"
        );
        allLotteries_[lotteryIdCounter_].lotteryStatus = LotteryUtils
            .Status
            .Open;
        emit ReopenLottery(msg.sender, lotteryIdCounter_);
    }

    function resetLotteryAndStartNewRound() external onlyOwner {
        require(
            allLotteries_[lotteryIdCounter_].lotteryStatus ==
                LotteryUtils.Status.RewardCompleted,
            "Current lottery reward should be calculated before start new round"
        );
        lotteryIdCounter_ = lotteryIdCounter_.add(1);
        allLotteries_[lotteryIdCounter_].lotteryStatus = LotteryUtils
            .Status
            .Open;
        emit NewRoundLottery(msg.sender, lotteryIdCounter_);
    }

    function setWinningNumbers(uint16[] calldata _numbers) external onlyOwner {
        require(
            _numbers.length == totalWinningNumber_,
            "Total winning numbers is not corrected"
        );
        require(
            allLotteries_[lotteryIdCounter_].lotteryStatus ==
                LotteryUtils.Status.Closed,
            "Current lottery should be Status.Closed"
        );

        LotteryUtils.Set storage winningNumbers = allLotteries_[
            lotteryIdCounter_
        ].winningNumbers;
        _setWinningNumber(winningNumbers, _numbers, totalLotteryNumber_);
        emit SetWinningNumbers(
            msg.sender,
            lotteryIdCounter_,
            winningNumbers.values,
            totalLotteryNumber_
        );

        uint256 totalReward = _calculateRewards(winningNumbers);
        _calculateBankerProfitLoss(totalReward);
        // Set lottery Status to RewardCompleted
        allLotteries_[lotteryIdCounter_].lotteryStatus ==
            LotteryUtils.Status.RewardCompleted;
    }

    //-------------------------------------------------------------------------
    // INTERNAL FUNCTIONS
    //-------------------------------------------------------------------------

    function _buyLottery(BuyLotteryInfo calldata _lottery)
        internal
        returns (uint256 amount)
    {
        uint16 lotteryNumber = _lottery.lotteryNumber;
        uint256 currentBetAmount = allLotteries_[lotteryIdCounter_]
            .totalAmountByNumber[lotteryNumber];
        uint256 maxAllowBetAmount = LotteryUtils.getMaxAllowBetAmount(
            currentStakedStableAmount_,
            currentBetAmount,
            allLotteries_[lotteryIdCounter_].totalAmount,
            totalLotteryNumber_,
            maxRewardMultiplier_,
            maxMultiplierSlippageTolerancePercentage_
        );
        amount = _lottery.amount;
        require(
            amount <= maxAllowBetAmount,
            "Lottery amount exceed max allowance"
        );

        uint256 multiplier = LotteryUtils.getRewardMultiplier(
            currentStakedStableAmount_,
            currentBetAmount,
            allLotteries_[lotteryIdCounter_].totalAmount,
            totalLotteryNumber_,
            maxRewardMultiplier_
        );
        uint256 rewardAmount = multiplier.mul(amount);
        // Create gambling info
        LotteryUtils.GamblingInfo memory gamblingInfo = LotteryUtils
            .GamblingInfo(msg.sender, lotteryNumber, amount, multiplier);
        // Add lottery gambling info to state
        allLotteries_[lotteryIdCounter_]
            .lottoGamblerByNumber[lotteryNumber]
            .push(gamblingInfo);
        allLotteries_[lotteryIdCounter_].lottoGamblerByAddress[msg.sender].push(
                gamblingInfo
            );
        allLotteries_[lotteryIdCounter_].totalAmountByNumber[
            lotteryNumber
        ] += amount;
        allLotteries_[lotteryIdCounter_].totalRewardAmountByNumber[
                lotteryNumber
            ] += rewardAmount;
        allLotteries_[lotteryIdCounter_].totalAmount += amount;

        // calculate locked stable and save into state
        _calculateLockedStableAmount(lotteryNumber);

        emit BuyLottery(msg.sender, lotteryNumber, amount, lotteryIdCounter_);
    }

    function _calculateLockedStableAmount(uint16 lotteryNumber) internal {
        uint256 totalRewardAmountByNumber = allLotteries_[lotteryIdCounter_]
            .totalRewardAmountByNumber[lotteryNumber];
        uint256 totalBetAmount = allLotteries_[lotteryIdCounter_].totalAmount;

        // if total reward amount is more than bet amount
        // we need to lock some staked stable
        if (totalRewardAmountByNumber > totalBetAmount) {
            uint256 totalRewardInStable = totalRewardAmountByNumber -
                totalBetAmount;
            uint256 lockedStableAmount = allLotteries_[lotteryIdCounter_]
                .lockedStableAmount;
            if (totalRewardInStable > lockedStableAmount) {
                allLotteries_[lotteryIdCounter_]
                    .lockedStableAmount = totalRewardInStable;
            }
        }
    }

    function _setWinningNumber(
        LotteryUtils.Set storage _set,
        uint16[] calldata _numbers,
        uint16 _totalLotteryNumber
    ) internal {
        for (uint16 index = 0; index < _numbers.length; index++) {
            uint16 number = _numbers[index];
            require(number < _totalLotteryNumber, "Invalid winning number");
            if (!_set.isExists[number]) {
                _set.values.push(number);
                _set.isExists[number] = true;
            }
        }
        require(
            _set.values.length == totalWinningNumber_,
            "Total winning numbers is not corrected"
        );
    }

    function _calculateRewards(LotteryUtils.Set storage _set)
        internal
        returns (uint256 totalReward)
    {
        for (uint16 i = 0; i < _set.values.length; i++) {
            uint16 winningNumber = _set.values[i];
            LotteryUtils.GamblingInfo[] memory gamblings = allLotteries_[
                lotteryIdCounter_
            ].lottoGamblerByNumber[winningNumber];
            for (uint256 j = 0; j < gamblings.length; j++) {
                LotteryUtils.GamblingInfo memory gambling = gamblings[j];
                require(
                    winningNumber == gambling.lotteryNumber,
                    "Lottery number not match"
                );
                uint256 reward = gambling.amount.mul(gambling.rewardMultiplier);
                gamblerReward_[gambling.gambler] += reward;
                totalReward += reward;
            }
        }
    }

    function _calculateBankerProfitLoss(uint256 _totalReward) internal {
        uint256 totalBetAmount = allLotteries_[lotteryIdCounter_].totalAmount;
        // if total reward less than total bet amount, then banker not loss any money
        // banker profit = totalBetAmount - totalReward - platform fee (to feeKeeper_)
        if (_totalReward < totalBetAmount) {
            uint256 remainingAmount = totalBetAmount - _totalReward;
            uint256 feeAmount = feePercentage_.mul(remainingAmount).div(100);
            // transfer fee to feeKeeper
            stable_.safeTransfer(feeKeeper_, feeAmount);
            // add reward to banker
            uint256 bankerReward = remainingAmount - feeAmount;
            // increase banker current stake stable amount
            currentStakedStableAmount_ += bankerReward;
        } else if (_totalReward > totalBetAmount) {
            // else if total reward is more than total bet amount,
            // banker will loss staked amount in percentage of (totalReward - totalBetAmount)/total staked amount
            uint256 stableNeeded = _totalReward - totalBetAmount;
            // remove stable from bankers
            currentStakedStableAmount_ -= stableNeeded;
        }
    }

    function _getBankerCurrentStableAmount(address _banker)
        internal
        view
        returns (uint256 currentAmount)
    {
        currentAmount = stableBanker_[_banker]
            .mul(currentStakedStableAmount_)
            .div(totalStakedStableAmount_);
    }

    function _getActualStakedShareForAmount(uint256 _amount)
        internal
        view
        returns (uint256 actualStakedShare)
    {
        actualStakedShare = _amount;
        if (
            currentStakedStableAmount_ != totalStakedStableAmount_ &&
            currentStakedStableAmount_ > 0
        ) {
            actualStakedShare = _amount.mul(totalStakedStableAmount_).div(
                currentStakedStableAmount_
            );
        }
    }
}
