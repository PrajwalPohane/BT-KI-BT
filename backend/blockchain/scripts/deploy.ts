import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const Registry = await ethers.getContractFactory("ConsortiumRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();

  await registry.registerInstitution(await deployer.getAddress());

  const Consent = await ethers.getContractFactory("ConsentContract");
  const consent = await Consent.deploy();
  await consent.waitForDeployment();

  const Audit = await ethers.getContractFactory("AuditLogContract");
  const audit = await Audit.deploy();
  await audit.waitForDeployment();

  const Access = await ethers.getContractFactory("AccessControlContract");
  const access = await Access.deploy(await consent.getAddress(), await audit.getAddress(), await registry.getAddress());
  await access.waitForDeployment();

  console.log("ConsortiumRegistry:", await registry.getAddress());
  console.log("ConsentContract:", await consent.getAddress());
  console.log("AuditLogContract:", await audit.getAddress());
  console.log("AccessControlContract:", await access.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
