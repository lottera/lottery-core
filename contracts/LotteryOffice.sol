// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Lottery.sol";
import "./interface/ILotteryOffice.sol";

contract LotteryOffice is OwnableUpgradeable, ILotteryOffice {
    // Libraries
    // Safe math
    using SafeMathUpgradeable for uint256;

    // Safe ERC20
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable internal stable_;
    address internal stableAddress_;

    struct Set {
        string[] values;
        mapping(string => bool) isExists;
    }
    mapping(string => address) public getLotteryAddress;
    mapping(address => string) public getLotteryName;
    mapping(address => bool) public isValidLottery;

    Set internal lotteryNames;

    // Mapping of banker's staked amount
    mapping(address => uint256) public getBankerShare;
    // Total Staked Share
    uint256 public totalStakedShare_;
    // Current Staked Amount
    uint256 public currentStakedAmount_;
    // Current locked Amount
    uint256 public currentLockedAmount_;
    // Created since
    uint256 internal createdSince_;

    uint256 internal constant WEI = 1 * (10**18);

    constructor() {}

    function initialize(address _stable) public initializer {
        __Ownable_init();
        stable_ = IERC20Upgradeable(_stable);
        stableAddress_ = _stable;
        createdSince_ = block.timestamp;
    }

    //-------------------------------------------------------------------------
    // General Access Functions
    //-------------------------------------------------------------------------

    function createNewLottery(
        string calldata _lotteryName,
        address _lotto,
        address _stable,
        address _factory,
        address _router,
        uint256 _maxRewardMultiplier,
        uint16 _totalLotteryNumber,
        uint256 _maxMultiplierSlippageTolerancePercentage,
        uint8 _totalWinningNumber,
        uint256 _feePercentage
    ) external override onlyOwner returns (address lottery) {
        require(
            lotteryNames.isExists[_lotteryName] == false,
            "Lottery name is exists"
        );

        require(bytes(_lotteryName).length > 0, "Invalid lottery name");

        bytes memory bytecode = type(Lottery).creationCode;
        bytes32 salt = keccak256(
            abi.encodePacked(
                _lotteryName,
                _maxRewardMultiplier,
                _totalLotteryNumber,
                _totalWinningNumber
            )
        );
        assembly {
            lottery := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        Lottery(lottery).initialize(
            _lotto,
            _stable,
            _factory,
            _router,
            address(this),
            _maxRewardMultiplier,
            _totalLotteryNumber,
            _maxMultiplierSlippageTolerancePercentage,
            _totalWinningNumber,
            _feePercentage
        );
        Lottery(lottery).setFeeKeeperAddress(msg.sender);
        Lottery(lottery).transferOwnership(msg.sender);
        // Update state
        lotteryNames.values.push(_lotteryName);
        lotteryNames.isExists[_lotteryName] = true;
        getLotteryAddress[_lotteryName] = lottery;
        getLotteryName[lottery] = _lotteryName;
        isValidLottery[lottery] = true;

        // Emit event
        emit LotteryCreated(
            _lotteryName,
            _maxRewardMultiplier,
            _totalLotteryNumber,
            _totalWinningNumber
        );
    }

    function lockBankerAmount(uint256 _amount) external override onlyLottery {
        require(
            currentLockedAmount_.add(_amount) <= currentStakedAmount_,
            "Cannot lock more that current staked amount"
        );
        currentLockedAmount_ = currentLockedAmount_.add(_amount);
    }

    function unlockBankerAmount(uint256 _amount) external override onlyLottery {
        require(
            _amount <= currentLockedAmount_,
            "Unlock amount must not greater that current locked amount"
        );
        currentLockedAmount_ = currentLockedAmount_.sub(_amount);
    }

    function withdrawBankerAmount(uint256 _amount)
        external
        override
        onlyLottery
    {
        require(
            _amount <= currentLockedAmount_,
            "Cannot withdraw more than current locked amount"
        );
        currentStakedAmount_ = currentStakedAmount_.sub(_amount);
        stable_.safeTransfer(msg.sender, _amount);
        emit WithdrawStableCoin(
            msg.sender,
            getLotteryName[msg.sender],
            _amount,
            currentStakedAmount_
        );
    }

    function depositBankerAmount(uint256 _amount)
        external
        override
        onlyLottery
    {
        stable_.safeTransferFrom(msg.sender, address(this), _amount);
        currentStakedAmount_ = currentStakedAmount_.add(_amount);
        emit DepositStableCoin(
            msg.sender,
            getLotteryName[msg.sender],
            _amount,
            currentStakedAmount_
        );
    }

    function stake(uint256 _amount) external override {
        require(_amount > 0, "Stake amount should be more than 0");
        // Transfer stable to contract
        stable_.safeTransferFrom(msg.sender, address(this), _amount);
        // find actual staked shared for banker
        uint256 actualStakedShare = _getActualStakedShareForAmount(_amount);
        // Add staked amount for banker to state
        getBankerShare[msg.sender] = getBankerShare[msg.sender].add(
            actualStakedShare
        );
        totalStakedShare_ = totalStakedShare_.add(actualStakedShare);
        currentStakedAmount_ = currentStakedAmount_.add(_amount);
        // Emit StakeStableCoin event
        emit StakeStableCoin(msg.sender, _amount, getBankerShare[msg.sender]);
    }

    function unstake(uint256 _amount) external override {
        require(
            _amount <= _getBankerCurrentStableAmount(msg.sender),
            "Unstake amount cannot more than staked amount"
        );
        uint256 unlockedStableAmount = currentStakedAmount_ -
            currentLockedAmount_;
        uint256 availableToUnstake = unlockedStableAmount
            .mul(getBankerShare[msg.sender])
            .div(currentStakedAmount_);

        require(
            _amount <= availableToUnstake,
            "Cannot unstake more than unlocked amount"
        );

        // Transfer stable to banker
        stable_.safeTransfer(msg.sender, _amount);
        // Adjust staked amount for banker to state
        // find actual staked amount to unstake
        uint256 actualStakedShare = _getActualStakedShareForAmount(_amount);

        getBankerShare[msg.sender] = getBankerShare[msg.sender].sub(
            actualStakedShare
        );
        totalStakedShare_ = totalStakedShare_.sub(actualStakedShare);
        currentStakedAmount_ = currentStakedAmount_.sub(_amount);
        // Emit UnstakeStableCoin event
        emit UnstakeStableCoin(
            msg.sender,
            actualStakedShare,
            _amount,
            getBankerShare[msg.sender]
        );
    }

    //-------------------------------------------------------------------------
    // View
    //-------------------------------------------------------------------------
    function getAvailableBankerAmount()
        external
        view
        override
        returns (uint256 availableAmount)
    {
        availableAmount = currentStakedAmount_ - currentLockedAmount_;
    }

    function getStakedAmount(address _banker)
        external
        view
        override
        returns (uint256 stakedAmount)
    {
        stakedAmount = _getBankerCurrentStableAmount(_banker);
    }

    function getTvl() external view override returns (uint256 tvl) {
        tvl = currentStakedAmount_;
    }

    function getEstimatedApy()
        external
        view
        override
        returns (uint256 estimatedApy)
    {
        if (currentStakedAmount_ > totalStakedShare_) {
            uint256 profit = currentStakedAmount_.sub(totalStakedShare_);
            uint256 diffTimestamp = block.timestamp - createdSince_;

            estimatedApy = profit.mul(365 days).mul(WEI).div(diffTimestamp).div(
                    totalStakedShare_
                );
        } else {
            estimatedApy = 0;
        }
    }

    function getLockedAmountPercentage()
        external
        view
        override
        returns (uint256 lockedAmountPercentage)
    {
        lockedAmountPercentage = currentLockedAmount_.mul(100).mul(WEI).div(
            currentStakedAmount_
        );
    }

    //-------------------------------------------------------------------------
    // Internal
    //-------------------------------------------------------------------------

    function _getBankerCurrentStableAmount(address _banker)
        internal
        view
        returns (uint256 currentAmount)
    {
        currentAmount = getBankerShare[_banker].mul(currentStakedAmount_).div(
            totalStakedShare_
        );
    }

    function _getActualStakedShareForAmount(uint256 _amount)
        internal
        view
        returns (uint256 actualStakedShare)
    {
        actualStakedShare = _amount;
        if (
            currentStakedAmount_ != totalStakedShare_ &&
            currentStakedAmount_ > 0
        ) {
            actualStakedShare = _amount.mul(totalStakedShare_).div(
                currentStakedAmount_
            );
        }
    }

    //-------------------------------------------------------------------------
    // Modifier
    //-------------------------------------------------------------------------

    modifier onlyLottery() {
        require(
            isValidLottery[msg.sender] == true,
            "OnlyLottery : caller is not valid lottery"
        );
        _;
    }
}
