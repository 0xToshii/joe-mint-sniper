import dotenv from "dotenv";
dotenv.config({path:'.env'});

import "@nomicfoundation/hardhat-toolbox";

const MAINNET_URL = process.env.MAINNET_RPC_URL;

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.6" }
    ],
  },
  networks: {
    hardhat: {
      forking: {
        url: MAINNET_URL,
        blockNumber: 19684722, // first allowlist mint: (block 19684722), last allowlist mint: (block 19685013), first public mint: (block 19685017)
        chainId: 41334
      }
    }
  },
  mocha: {
    timeout: 300 * 1e3,
  }
};

export default config;
