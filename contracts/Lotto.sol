// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Lotto is ERC20, Ownable {
    constructor(uint256 _initialSupply) ERC20("Lotto", "Lotto") {
        _mint(msg.sender, _initialSupply * (10 ** decimals()));
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}