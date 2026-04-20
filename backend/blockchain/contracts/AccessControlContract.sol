// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./ConsentContract.sol";
import "./AuditLogContract.sol";
import "./ConsortiumRegistry.sol";

contract AccessControlContract {
    ConsentContract public consentContract;
    AuditLogContract public auditLogContract;
    ConsortiumRegistry public consortiumRegistry;

    event AccessDecision(address indexed patient, address indexed requester, bytes32 indexed dataType, bytes32 purpose, bool granted, bytes32 tokenHash);

    constructor(address consentAddress, address auditAddress, address registryAddress) {
        consentContract = ConsentContract(consentAddress);
        auditLogContract = AuditLogContract(auditAddress);
        consortiumRegistry = ConsortiumRegistry(registryAddress);
    }

    function requestAccess(address patient, bytes32 dataType, bytes32 purpose) external returns (bool granted, bytes32 tokenHash) {
        bool verified = consortiumRegistry.isVerified(msg.sender);
        if (!verified) {
            granted = false;
            tokenHash = keccak256(abi.encodePacked(patient, msg.sender, dataType, purpose, block.timestamp, granted));
            auditLogContract.write(patient, msg.sender, dataType, purpose, granted, tokenHash);
            emit AccessDecision(patient, msg.sender, dataType, purpose, granted, tokenHash);
            return (granted, tokenHash);
        }

        ConsentContract.Consent memory consent = consentContract.getConsent(patient, msg.sender, dataType);

        granted =
            consent.patient == patient &&
            consent.hospital == msg.sender &&
            consent.dataType == dataType &&
            consent.active &&
            block.timestamp <= consent.expiry &&
            consent.purpose == purpose;

        tokenHash = keccak256(abi.encodePacked(patient, msg.sender, dataType, purpose, block.timestamp, granted));

        auditLogContract.write(patient, msg.sender, dataType, purpose, granted, tokenHash);
        emit AccessDecision(patient, msg.sender, dataType, purpose, granted, tokenHash);

        return (granted, tokenHash);
    }
}
