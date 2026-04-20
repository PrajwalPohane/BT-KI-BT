// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AuditLogContract {
    struct AuditEntry {
        address patient;
        address requester;
        bytes32 dataType;
        bytes32 purpose;
        bool granted;
        uint256 timestamp;
        bytes32 tokenHash;
    }

    AuditEntry[] private entries;

    event AccessLogged(uint256 indexed index, address indexed patient, address indexed requester, bytes32 dataType, bytes32 purpose, bool granted, bytes32 tokenHash);

    function write(
        address patient,
        address requester,
        bytes32 dataType,
        bytes32 purpose,
        bool granted,
        bytes32 tokenHash
    ) external {
        entries.push(
            AuditEntry({
                patient: patient,
                requester: requester,
                dataType: dataType,
                purpose: purpose,
                granted: granted,
                timestamp: block.timestamp,
                tokenHash: tokenHash
            })
        );

        emit AccessLogged(entries.length - 1, patient, requester, dataType, purpose, granted, tokenHash);
    }

    function totalEntries() external view returns (uint256) {
        return entries.length;
    }
}
