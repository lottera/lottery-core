// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Lotto is ERC20, Ownable {

    address public minter;

    constructor(uint256 _initialSupply) ERC20("Lotto", "Lotto") {
        _mint(msg.sender, _initialSupply * (10 ** decimals()));
        minter = msg.sender;
    }

    function mint(address _to, uint256 _amount) public onlyMinter {
        _mint(_to, _amount);
    }

    //-------------------------------------------------------------------------
    // MODIFIERS
    //-------------------------------------------------------------------------

    modifier onlyMinter() {
        require(msg.sender == minter, "only minter");
        _;
    }

     //-------------------------------------------------------------------------
    // STATE MODIFYING FUNCTIONS
    // Restricted Access Functions (onlyOwner)
    //-------------------------------------------------------------------------
    function setMinterAddress(address _newAddress) external onlyOwner {
        minter = _newAddress;
    }
    
}