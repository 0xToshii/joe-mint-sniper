/*
 * running the allowList snipe bot
 */

import { expect } from "chai";
import { Contract, Signer, BigNumber } from "ethers";
import { ethers } from "hardhat";

const flatLaunchpegAbi = require("../abi/FlatLaunchpeg.json");

const BN = BigNumber;
let precision = BN.from(10).pow(18);

let accounts: Signer[];
let runner: Signer;
let o1: Signer;
let o2: Signer;
let o3: Signer;
let o4: Signer;
let o5: Signer;
let minters: String[];
let owner: Signer; // for impersonation
let flatLaunchpeg: Contract;
let sniper: Contract;
let painightAddress = '0x048c939bea33c5df4d2c69414b9385d55b3ba62e';


/// starting state
before(async () => {

  accounts = await ethers.getSigners();
  [runner,o1,o2,o3,o4,o5] = accounts;
  minters = [await o1.getAddress(), await o2.getAddress(), await o3.getAddress(), await o4.getAddress(), await o5.getAddress()]

  // this is the flatLaunchpeg contract associated with PAINIGHT
  flatLaunchpeg = new ethers.Contract(painightAddress,flatLaunchpegAbi)

  let ownerAddress = await flatLaunchpeg.connect(runner).owner()
  owner = await ethers.getImpersonatedSigner(ownerAddress) // impersonating nft contract owner

  let sniperFactory = await ethers.getContractFactory('BotRunner')
  sniper = await sniperFactory.connect(runner).deploy()

  // checking starting state
  for (let i=0; i<5; i++) {
    expect(await flatLaunchpeg.connect(runner).balanceOf(minters[i])).to.be.equal(0)
  }

});

/// running the snipe
it("snip-snip", async () => {

  // requirement: get specific addresses WLed for project of interest

  // generating the fixed WL addresses to use based on salt RNG
  let salt = 100
  let mintAmounts = [5,5,5,5,5]
  let wlAddresses = []

  for (let i=0; i<5; i++) {
    wlAddresses.push(await sniper.connect(runner).getContractAddress(salt+i))
  }

  // getting the select addresses WLed by project owner
  await flatLaunchpeg.connect(owner).seedAllowlist(wlAddresses,mintAmounts)


  // running the snipe:

  // fund deterministic contracts (WL addresses) for mint
  // in practice have your users fund their assigned address
  let minterSigners = [o1,o2,o3,o4,o5]
  for (let i=0; i<wlAddresses.length; i++) {
    await minterSigners[i].sendTransaction({to:wlAddresses[i], value:ethers.utils.parseEther("20.0"), gasLimit:1_000_000})
  }

  // gathering the starting index your users mint - all mints are in a row for snipe
  let devMintedNo = await flatLaunchpeg.connect(runner).amountMintedByDevs()
  let allowlistMintedNo = await flatLaunchpeg.connect(runner).amountMintedDuringAllowlist()
  let startingIndex = BN.from(devMintedNo).add(BN.from(allowlistMintedNo))

  // init the mini bots for minting (anytime prior to mint)
  // in practice only init those addresses your minions got WLed
  let tx = await sniper.connect(runner).initMiniBots(salt,5)
  let receipt = await tx.wait()
  console.log("--init gas:",receipt.cumulativeGasUsed)

  // running the snipe
  let mintPrice = await flatLaunchpeg.connect(runner).allowlistPrice()
  tx = await sniper.connect(runner).runSnipe(flatLaunchpeg.address,mintAmounts,mintPrice)
  receipt = await tx.wait()
  console.log("--mint gas:",receipt.cumulativeGasUsed)

  // running the mint transfer
  tx = await sniper.connect(runner).transferMints(startingIndex,minters,mintAmounts)
  receipt = await tx.wait()
  console.log("--tran gas:",receipt.cumulativeGasUsed)

});

/// ending state
after(async () => {

  // checking ending state
  for (let i=0; i<5; i++) {
    expect(await flatLaunchpeg.connect(runner).balanceOf(minters[i])).to.be.equal(5)
  }
  
});