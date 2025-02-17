const {
    Connection
} = require("@solana/web3.js");
const connection = new Connection(`https://solana-mainnet.api.syndica.io/api-key/${process.env.SYNDICA_API_KEY}`, 'confirmed');

// const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const connection2 = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, 'confirmed');
const connection3 = new Connection(`https://solana-mainnet.api.syndica.io/api-key/${process.env.SYNDICA_API_KEY}`, 'confirmed');

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

const validateSolAmountRange = (input) => {
    console.log("validateSolAmountRange",input);
    const minSolAmount = parseFloat(0.001);
    const maxSolAmount = parseFloat(100);
    const rangePattern = /^(\d+(\.\d+)?)-(\d+(\.\d+)?)$/;
    const match = input.match(rangePattern);

    if (!match)
        return { valid: false, message: '❌ Invalid format! Use min-max (e.g., 1-2, 30-50).' };


    let min = parseFloat(match[1]);
    let max = parseFloat(match[3]);

    if (isNaN(min) || isNaN(max) || min < Number(minSolAmount) || max > Number(maxSolAmount) || min >= max) {
        return { valid: false, message: `❌ Invalid range! Ensure min is at least ${minSolAmount}, max is at most ${maxSolAmount}, and min < max.` };
    }

    return { valid: true, min, max };
}

const getBatchSize = (transactionsPerMinute) => parseInt(transactionsPerMinute) === 60 ? 5 : parseInt(transactionsPerMinute) === 30 ? 3 : 1;



module.exports = {
    connection,
    connection2,
    connection3,
    privateKey,
    wsolAddress,
    slippage: 4,
    tax: 0.001, //fee in sol
    minSolAmount: 0.001,
    minSolBalance: 0.1,
    transactionsPerMinute,
    averageFee: 0.0005,
    averageJitofee: 0.0007,
    getDelayMs,
    validateSolAmountRange,
    getBatchSize
}
