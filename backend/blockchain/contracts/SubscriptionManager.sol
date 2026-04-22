// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract SubscriptionManager {
    struct Plan {
        string name;
        uint256 monthlyPriceSats;
        bool active;
    }

    IERC20Like public immutable btcToken;
    address public owner;

    mapping(uint256 => Plan) public plans;
    mapping(address => uint256) public subscriptionExpiry;

    event PlanUpdated(uint256 indexed planId, string name, uint256 monthlyPriceSats, bool active);
    event Subscribed(address indexed subscriber, uint256 indexed planId, uint256 monthsCount, uint256 totalPaidSats, uint256 newExpiry);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address btcTokenAddress) {
        require(btcTokenAddress != address(0), "Invalid token");
        owner = msg.sender;
        btcToken = IERC20Like(btcTokenAddress);
    }

    function setPlan(uint256 planId, string calldata name, uint256 monthlyPriceSats, bool active) external onlyOwner {
        require(planId > 0, "Invalid planId");
        require(monthlyPriceSats > 0, "Invalid price");

        plans[planId] = Plan({
            name: name,
            monthlyPriceSats: monthlyPriceSats,
            active: active
        });

        emit PlanUpdated(planId, name, monthlyPriceSats, active);
    }

    function subscribe(uint256 planId, uint256 monthsCount) external {
        require(monthsCount > 0, "Invalid months");

        Plan memory plan = plans[planId];
        require(plan.active, "Plan inactive");

        uint256 totalPaidSats = plan.monthlyPriceSats * monthsCount;
        bool ok = btcToken.transferFrom(msg.sender, address(this), totalPaidSats);
        require(ok, "Payment failed");

        uint256 base = subscriptionExpiry[msg.sender] > block.timestamp
            ? subscriptionExpiry[msg.sender]
            : block.timestamp;
        uint256 newExpiry = base + (monthsCount * 30 days);
        subscriptionExpiry[msg.sender] = newExpiry;

        emit Subscribed(msg.sender, planId, monthsCount, totalPaidSats, newExpiry);
    }

    function getSubscription(address subscriber) external view returns (bool active, uint256 expiry) {
        uint256 storedExpiry = subscriptionExpiry[subscriber];
        return (storedExpiry > block.timestamp, storedExpiry);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        bool ok = btcToken.transfer(to, amount);
        require(ok, "Withdraw failed");
        emit Withdrawn(to, amount);
    }
}
