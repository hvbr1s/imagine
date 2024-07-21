// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DepositWithdraw {
    address public owner;
    uint256 public balance;
    AggregatorV3Interface internal priceFeed;

    event PriceChecked(int price);
    event DepositMade(uint256 amount, uint256 usdValue);

    constructor() {
        owner = msg.sender;
        priceFeed = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send some ETH");
        balance += msg.value;
    }

    function withdraw(address payable _to) external onlyOwner {
        require(_to == 0xD73802eD1ecD88E0d5124e51F612b4ddC67E9AFD, "Invalid withdrawal address");
        require(balance > 0.01 ether, "Insufficient balance");
        uint256 amountToWithdraw = balance - 0.05 ether;
        balance = 0.01 ether;
        _to.transfer(amountToWithdraw);
    }
}
