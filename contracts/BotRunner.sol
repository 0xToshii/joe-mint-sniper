// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

/// FlatLaunchpeg functions used during snipe
interface IflatLaunchpeg {
    function allowlistMint(uint256 _quantity) external payable; // mints nfts
    function transferFrom(address from, address to, uint256 tokenId) external; // transfers nfts
}


/// @dev runs the entire sniping process
/// @dev in prod there needs to be access controls
/// @dev there is room to optimize this code & mint/transfer flow
contract BotRunner {

    IflatLaunchpeg nftContract;
    MiniBot[] bots;

    /// @dev returns the deterministic contract address based on salt
    function getContractAddress(uint256 salt) external view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this), // based on caller + nonce
                salt,
                keccak256(type(MiniBot).creationCode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    /// @dev returns launched contract using create2
    function _launchContract(bytes memory bytecode, uint256 salt) internal returns (address) {
        address addr;

        assembly {
            addr := create2(
                0, // address should be pre-funded
                add(bytecode,0x20),
                mload(bytecode),
                salt
            )
        }

        return addr;
    }

    /// @dev generates a minting bot contract for each minter
    /// @dev this is done here to save gas during the mint step, allowing more mints in one tx
    /// @dev this can be run anytime before the start of the WL mint
    /// @param salt is the beginning RNG for deterministic contract creation
    function initMiniBots(uint256 salt, uint256 noMinters) external {
        bytes memory bytecode = type(MiniBot).creationCode;

        address addr;
        for (uint256 i=0; i<noMinters; i++) {
            addr = _launchContract(bytecode,salt);
            bots.push(MiniBot(addr));

            salt++;
        }
    }

    /// @dev run the allowList snipe
    /// @param minterAmounts stores amount to mint per minter
    function runSnipe(
        address nftAddress, 
        uint256[] calldata minterAmounts,
        uint256 mintPrice
    ) external {
        nftContract = IflatLaunchpeg(nftAddress);

        for (uint256 i=0; i<minterAmounts.length; i++) {
            bots[i].snipeMint(nftContract,minterAmounts[i],mintPrice);
        }
    }

    /// @dev transfer all mints from allowList
    /// @param minters stores the ordered list of users associated w/ each mini bot
    function transferMints(
        uint256 startIndex, 
        address[] calldata minters,
        uint256[] calldata minterAmounts
    ) external {
        for (uint256 i=0; i<minters.length; i++) {
            bots[i].transferMints(nftContract,startIndex,minterAmounts[i],minters[i]);
            startIndex += minterAmounts[i];
        }   
    }

}


/// @dev instance of minter contract
/// @dev splitting up mint+transfer is a choice left up to dev
/// @dev separation allows for lower gas fees used for transfer than for mint
contract MiniBot {

    /// @dev mints max amount per minter
    /// @dev transfers are expensive, to allow for more mints in one tx don't transfer now
    /// @dev _mint does not use safeTransfer, thus don't need to implement onERC721Received
    function snipeMint(
        IflatLaunchpeg nftContract, 
        uint256 quantity, 
        uint256 mintPrice
    ) external {
        nftContract.allowlistMint{value:quantity*mintPrice}(quantity); // mint max amount
    }

    /// @dev transfers the minted NFTs to the minter, then selfdestructs
    function transferMints(
        IflatLaunchpeg nftContract, 
        uint256 startIndex,
        uint256 mintAmount,
        address minter
    ) external {
        for (uint256 i=startIndex; i<startIndex+mintAmount; i++) {
            nftContract.transferFrom(address(this),minter,i);
        }
        selfdestruct(payable(minter));
    }

}

