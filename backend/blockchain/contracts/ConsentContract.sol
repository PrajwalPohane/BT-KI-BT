// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ConsentContract {
    struct Consent {
        address patient;
        address hospital;
        bytes32 dataType;
        bytes32 purpose;
        uint256 expiry;
        bool active;
    }

    mapping(bytes32 => Consent) private consents;

    event ConsentGranted(bytes32 indexed key, address indexed patient, address indexed hospital, bytes32 dataType, bytes32 purpose, uint256 expiry);
    event ConsentRevoked(bytes32 indexed key, address indexed patient, address indexed hospital, bytes32 dataType);

    function computeKey(address patient, address hospital, bytes32 dataType) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(patient, hospital, dataType));
    }

    function grantConsent(address hospital, bytes32 dataType, bytes32 purpose, uint256 expiry) external {
        require(hospital != address(0), "Invalid hospital");
        require(expiry > block.timestamp, "Invalid expiry");

        bytes32 key = computeKey(msg.sender, hospital, dataType);
        consents[key] = Consent({
            patient: msg.sender,
            hospital: hospital,
            dataType: dataType,
            purpose: purpose,
            expiry: expiry,
            active: true
        });

        emit ConsentGranted(key, msg.sender, hospital, dataType, purpose, expiry);
    }

    function revokeConsent(address hospital, bytes32 dataType) external {
        bytes32 key = computeKey(msg.sender, hospital, dataType);
        Consent storage consent = consents[key];

        require(consent.patient == msg.sender, "Not consent owner");
        require(consent.active, "Already inactive");

        consent.active = false;

        emit ConsentRevoked(key, msg.sender, hospital, dataType);
    }

    function getConsent(address patient, address hospital, bytes32 dataType) external view returns (Consent memory) {
        bytes32 key = computeKey(patient, hospital, dataType);
        return consents[key];
    }
}
