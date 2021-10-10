// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract LotteryCafe is OwnableUpgradeable {
    // Libraries
    // Safe math
    using SafeMathUpgradeable for uint256;

    // Safe ERC20
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable internal stableLottoLp_;
    address internal stableLottoLpAddress_;

    IERC20Upgradeable internal lotto_;
    address internal lottoAddress_;

    // Info of each user.
    struct UserInfo {
        uint256 shareAmount;    
        uint256 pendingRewards; 
        uint256 lastActivityBlock;
        uint256 totalRewards;
    }

    // Mapping of staked amount
    mapping(address => UserInfo) public getUserInfo;
    // Total Staked Share
    uint256 public totalStakedShare;
    // Lotto rewards per block
    uint256 public lottoRewardsPerBlock;
    // Constant Q value for calculation
    uint256 internal constant Q = 1e12;
    constructor() {}

    function initialize(address _stableLottoLp, address _lotto, uint256 _lottoRewardsPerBlock) public initializer {
        __Ownable_init();
        stableLottoLp_ = IERC20Upgradeable(_stableLottoLp);
        stableLottoLpAddress_ = _stableLottoLp;

        lotto_ = IERC20Upgradeable(_lotto);
        lottoAddress_ = _lotto;

        lottoRewardsPerBlock = _lottoRewardsPerBlock.mul(Q); // 0.2 per block ~ 200% cal at 28000 block per day // mul by 1e12
    }


    //-------------------------------------------------------------------------
    // View
    //-------------------------------------------------------------------------
    function getRewards(address _user)
        external
        view
        returns (uint256 rewards)
    {
        UserInfo storage user = getUserInfo[_user];
        rewards = 0;
    }
}
