// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "./Lotto.sol";

contract LotteryCafe is OwnableUpgradeable {
    // Libraries
    // Safe math
    using SafeMathUpgradeable for uint256;

    IUniswapV2Pair internal lp_;
    address internal lpAddress_;

    Lotto internal lotto_;
    address internal lottoAddress_;

    // Info of each user.
    struct UserInfo {
        uint256 shareAmount;
        uint256 rewardDebt;
        uint256 claimableRewards;
        uint256 totalRewards;
    }

    // Mapping of staked amount
    mapping(address => UserInfo) public getUserInfo;

    // Lotto rewards per block
    uint256 public lottoRewardsPerBlockQ;

    // Constant Q value for calculation
    uint256 internal constant Q = 1e12;
    uint256 internal constant WEI = 1 * (10**18);

    // Milliseconds of period that rewards will be locked and constantly release until 100%
    uint256 public rewardsLockedMilliSeconds;

    // Created since
    uint256 public createdSince;

    // Accumulated Rewards per share
    uint256 public accumulatedRewardsPerShare;

    // Last rewards block
    uint256 public lastRewardsBlock;
    uint256 public lastRewardsTimestamp;

    constructor() {}

    function initialize(
        address _stableLottoLp,
        address _lotto,
        uint256 _lottoRewardsPerBlock,
        uint16 _rewardsLockedDays
    ) public initializer {
        __Ownable_init();
        lp_ = IUniswapV2Pair(_stableLottoLp);
        lpAddress_ = _stableLottoLp;

        lotto_ = Lotto(_lotto);
        lottoAddress_ = _lotto;

        lottoRewardsPerBlockQ = _lottoRewardsPerBlock.mul(Q);

        rewardsLockedMilliSeconds = _rewardsLockedDays * 1 days;
        createdSince = block.timestamp;

        accumulatedRewardsPerShare = 0;

        lastRewardsBlock = block.number;
        lastRewardsTimestamp = block.timestamp;
    }

    //-------------------------------------------------------------------------
    // View
    //-------------------------------------------------------------------------
    function getRewards(address _user) external view returns (uint256 rewards) {
        UserInfo storage user = getUserInfo[_user];
        uint256 tempAccumulatedRewardsPerShare = accumulatedRewardsPerShare;
        if (block.number > lastRewardsBlock) {
            uint256 lpSupply = lp_.balanceOf(address(this));
            uint256 multiplier = block.number - lastRewardsBlock;
            uint256 totalRewards = multiplier.mul(lottoRewardsPerBlockQ);
            tempAccumulatedRewardsPerShare = accumulatedRewardsPerShare.add(
                totalRewards.div(lpSupply)
            );
        }

        rewards = user
            .shareAmount
            .mul(tempAccumulatedRewardsPerShare)
            .div(Q)
            .sub(user.rewardDebt)
            .add(user.claimableRewards);
    }

    function getTvl() public view returns (uint256 tvl) {
        uint256 lpStaked = lp_.balanceOf(address(this));
        uint256 totalSupply = lp_.totalSupply();
        (uint256 reserves0, uint256 reserves1, ) = lp_.getReserves();
        uint256 reserveStable = lottoAddress_ == lp_.token0()
            ? reserves1
            : reserves0;
        tvl = reserveStable.mul(lpStaked).div(totalSupply).mul(2);
    }

    function getApr() external view returns (uint256 apr) {
        uint256 diffTimestamp = block.timestamp - lastRewardsTimestamp;
        uint256 diffBlock = block.number - lastRewardsBlock;
        uint256 rewards = diffBlock.mul(lottoRewardsPerBlockQ);
        uint256 rewardsPerYear = rewards
            .mul(1 days)
            .mul(365)
            .div(diffTimestamp)
            .div(Q);

        (uint256 reserves0, uint256 reserves1, ) = lp_.getReserves();
        (uint256 reserveLotto, uint256 reserveStable) = lottoAddress_ ==
            lp_.token0()
            ? (reserves0, reserves1)
            : (reserves1, reserves0);

        uint256 rewardsPerYearInStable = rewardsPerYear.mul(reserveStable).div(
            reserveLotto
        );
        apr = rewardsPerYearInStable.mul(100).mul(WEI).div(getTvl());
    }

    function getUnlockedRewardsPercentage() external view returns (uint256 unlockedRewardsPercentage) {
        uint256 diffNow = block.timestamp - createdSince;
        if(diffNow >= rewardsLockedMilliSeconds) {
            unlockedRewardsPercentage = 100 * WEI;
        } else {
            unlockedRewardsPercentage = diffNow.mul(100).mul(WEI).div(rewardsLockedMilliSeconds);
        }
    }

    //-------------------------------------------------------------------------
    // External
    //-------------------------------------------------------------------------
    function stake(uint256 _amount) external {
        require(_amount > 0, "Stake amount should more than 0");
        UserInfo storage user = getUserInfo[msg.sender];
        updateState();
        lp_.transferFrom(msg.sender, address(this), _amount);
        user.shareAmount = user.shareAmount.add(_amount);

        user.rewardDebt = user.rewardDebt.add(
            _amount.mul(accumulatedRewardsPerShare).div(Q)
        );

        emit Stake(msg.sender, _amount,  user.shareAmount);
    }

    function unstake(uint256 _amount) external {
        UserInfo storage user = getUserInfo[msg.sender];
        require(_amount >= user.shareAmount && _amount > 0, "Invalid amount");

        updateState();
        uint256 pending = user
            .shareAmount
            .mul(accumulatedRewardsPerShare)
            .div(Q)
            .sub(user.rewardDebt);
        if (pending > 0) {
            user.claimableRewards = user.claimableRewards.add(pending);
            user.totalRewards = user.totalRewards.add(pending);
        }
        user.shareAmount = user.shareAmount.sub(_amount);
        lp_.transfer(msg.sender, _amount);
        user.rewardDebt = user.shareAmount.mul(accumulatedRewardsPerShare).div(
            Q
        );

        emit Unstake(msg.sender, _amount, user.shareAmount);
    }

    function claimRewards() external {
        UserInfo storage user = getUserInfo[msg.sender];
        updateState();
        uint256 pending = user
            .shareAmount
            .mul(accumulatedRewardsPerShare)
            .div(Q)
            .sub(user.rewardDebt);
        if (pending > 0) {
            user.claimableRewards = user.claimableRewards.add(pending);
            user.totalRewards = user.totalRewards.add(pending);
            
        }
        uint256 diffNow = block.timestamp - createdSince;
        
        uint256 unlockedRewards = diffNow < rewardsLockedMilliSeconds 
            ? user.totalRewards.mul(diffNow).div(rewardsLockedMilliSeconds)
            : user.totalRewards;
        
        uint256 claimedRewards = unlockedRewards > user.claimableRewards ? user.claimableRewards : unlockedRewards;
        user.claimableRewards = user.claimableRewards.sub(claimedRewards);
        lotto_.mint(msg.sender, claimedRewards);
        user.rewardDebt = user.shareAmount.mul(accumulatedRewardsPerShare).div(
            Q
        );

        emit Claim(msg.sender, claimedRewards, user.claimableRewards);
    }

    function updateState() public {
        if (block.number <= lastRewardsBlock) {
            return;
        }
        uint256 lpSupply = lp_.balanceOf(address(this));
        if (lpSupply == 0) {
            lastRewardsBlock = block.number;
            lastRewardsTimestamp = block.timestamp;
            return;
        }
        uint256 multiplier = block.number - lastRewardsBlock;
        uint256 rewards = multiplier.mul(lottoRewardsPerBlockQ);

        accumulatedRewardsPerShare = accumulatedRewardsPerShare.add(
            rewards.div(lpSupply)
        );
        lastRewardsBlock = block.number;
        lastRewardsTimestamp = block.timestamp;
    }

    //-------------------------------------------------------------------------
    // Owner
    //-------------------------------------------------------------------------
    function setLottoRewardsPerBlock(uint256 _lottoRewardsPerBlock)
        external
        onlyOwner
    {
        lottoRewardsPerBlockQ = _lottoRewardsPerBlock.mul(Q);
    }

    //-------------------------------------------------------------------------
    // Event
    //-------------------------------------------------------------------------
    event Stake(
        address indexed user,
        uint256 amount,
        uint256 total
    );

    event Unstake(
        address indexed user,
        uint256 amount,
        uint256 remaining
    );

    event Claim(
        address indexed user,
        uint256 amount,
        uint256 lockedAmount
    );
}
