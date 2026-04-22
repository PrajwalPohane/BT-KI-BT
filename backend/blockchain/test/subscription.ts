import { expect } from "chai";
import { ethers } from "hardhat";

describe("SubscriptionManager", function () {
  it("accepts BTC-style token payment and activates subscription", async function () {
    const [owner, patient] = await ethers.getSigners();

    const MockBitcoin = await ethers.getContractFactory("MockBitcoinToken");
    const btc: any = await MockBitcoin.deploy(ethers.parseUnits("100", 8));

    const Subscription = await ethers.getContractFactory("SubscriptionManager");
    const subscription: any = await Subscription.deploy(await btc.getAddress());

    await subscription.setPlan(1, "Basic Monthly", ethers.parseUnits("0.001", 8), true);

    await btc.mint(await patient.getAddress(), ethers.parseUnits("1", 8));
    await btc.connect(patient).approve(await subscription.getAddress(), ethers.parseUnits("0.002", 8));

    await subscription.connect(patient).subscribe(1, 2);

    const result = await subscription.getSubscription(await patient.getAddress());
    expect(result[0]).to.equal(true);
    expect(result[1] > 0n).to.equal(true);
  });
});