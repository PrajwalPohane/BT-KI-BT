import { expect } from "chai";
import { ethers } from "hardhat";

describe("AccessControlContract", function () {
  it("grants access when consent is valid", async function () {
    const [, patient, hospital, outsider] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("ConsortiumRegistry");
    const registry: any = await Registry.deploy();
    await registry.registerInstitution(await hospital.getAddress());

    const Consent = await ethers.getContractFactory("ConsentContract");
    const consent: any = await Consent.deploy();

    const Audit = await ethers.getContractFactory("AuditLogContract");
    const audit: any = await Audit.deploy();

    const Access = await ethers.getContractFactory("AccessControlContract");
    const access: any = await Access.deploy(await consent.getAddress(), await audit.getAddress(), await registry.getAddress());

    const dataType = ethers.encodeBytes32String("radiology");
    const purpose = ethers.encodeBytes32String("treatment");
    const now = (await ethers.provider.getBlock("latest"))!.timestamp;
    const expiry = now + 3600;

    await consent.connect(patient).grantConsent(await hospital.getAddress(), dataType, purpose, expiry);

    const tx = await access.connect(hospital).requestAccess(await patient.getAddress(), dataType, purpose);
    await tx.wait();

    const deniedTx = await access.connect(outsider).requestAccess(await patient.getAddress(), dataType, purpose);
    await deniedTx.wait();

    const total = await audit.totalEntries();
    expect(total).to.equal(2n);
  });
});
