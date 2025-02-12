const {
    Connection
} = require("@solana/web3.js");

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const connection2 = new Connection('https://mainnet.helius-rpc.com/?api-key=', 'confirmed');

// const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const privateKey = "";
const wsolAddress = "So11111111111111111111111111111111111111112";

const transactionsPerMinute = {
    "Regular": 5,
    "Fast": 30,
    "Turbo": 60
}


const getDelayMs = (t) => {
    const delayMs = (60 / t) * 1000; // Calculate delay in milliseconds

    if (delayMs >= 1000) {
        return Math.round(delayMs / 1000) + "s"; // Convert to whole seconds
    } else {
        return Math.round(delayMs) + "ms"; // Keep it in whole milliseconds
    }
};



module.exports = {
    connection,
    connection2,
    privateKey,
    wsolAddress,
    slippage: 4,
    tax: 0.5,
    minSolAmount: 0.001,
    transactionsPerMinute,
    getDelayMs
}
