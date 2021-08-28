// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Lottery.sol";

contract LotteryFactory is Ownable {
    struct Set {
        string[] values;
        mapping(string => bool) isExists;
    }
    mapping(string => address) public getLotteryAddress;
    mapping(address => string) public getLotteryName;
    mapping(address => bool) public isValidLottery;

    Set internal lotteryNames;

    constructor() {}

    //-------------------------------------------------------------------------
    // Event
    //-------------------------------------------------------------------------
    event LotteryCreated(
        string lotteryName,
        uint256 maxRewardMultiplier,
        uint16 totalLotteryNumber,
        uint8 totalWinningNumber
    );

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
    ) external onlyOwner returns (address lottery) {
        require(
            lotteryNames.isExists[_lotteryName] == false,
            "Lottery name is exists"
        );

        require(
            bytes(_lotteryName).length > 0,
            "Invalid lottery name"
        );

        bytes memory bytecode = abi.encodePacked(
            type(Lottery).creationCode,
            abi.encode(
                _lotto,
                _stable,
                _factory,
                _router,
                _maxRewardMultiplier,
                _totalLotteryNumber,
                _maxMultiplierSlippageTolerancePercentage,
                _totalWinningNumber,
                _feePercentage
            )
        );
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

    //-------------------------------------------------------------------------
    // Modifier
    //-------------------------------------------------------------------------

    modifier onlyLottery() {
        require(isValidLottery[msg.sender] == true, "OnlyLottery : caller is not valid lottery");
        _;
    }
}
