// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract ConsortiumRegistry {
    address public admin;
    mapping(address => bool) private verifiedInstitutions;

    event InstitutionRegistered(address indexed institution);
    event InstitutionRevoked(address indexed institution);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function registerInstitution(address institution) external onlyAdmin {
        require(institution != address(0), "Invalid institution");
        verifiedInstitutions[institution] = true;
        emit InstitutionRegistered(institution);
    }

    function revokeInstitution(address institution) external onlyAdmin {
        verifiedInstitutions[institution] = false;
        emit InstitutionRevoked(institution);
    }

    function isVerified(address institution) external view returns (bool) {
        return verifiedInstitutions[institution];
    }
}
