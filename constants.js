const {
    Connection
} = require("@solana/web3.js");

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const connection2 = new Connection('https://mainnet.helius-rpc.com/?api-key=', 'confirmed');

// const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const privateKey = "";
const wsolAddress = "So11111111111111111111111111111111111111112";

module.exports = {
    connection,
    connection2,
    privateKey,
    wsolAddress,
    slippage: 4,
    tax: 0.5
}
