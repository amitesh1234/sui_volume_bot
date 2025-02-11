const db = require("./pg.js");

exports.getActiveWallet = async() => {
    try {
    const rows = await db.query("SELECT * FROM wallets where isactive=$1", [true]);
    return rows;
    } catch(err) {
        console.log("Error in [getActiveWallet]: ", err);
        throw new Error("Error in [getActiveWallet]");
    }
}

exports.updateInactiveWallets = async() => {
    try {
    const rows = await db.query("UPDATE wallets set isactive=$1", [false]);
    return rows;
    } catch(err) {
        console.log("Error in [getActiveWallet]: ", err);
        throw new Error("Error in [getActiveWallet]");
    }
}

exports.insertActiveWallet = async(publicKey, privateKey) => {
    try {
    const rows = await db.query("INSERT INTO wallets (publicKey, privateKey, isactive) VALUES ($1, $2, $3);", [publicKey, privateKey, true]);
    return rows;
    } catch(err) {
        console.log("Error in [insertActiveWallet]: ", err);
        throw new Error("Error in [insertActiveWallet]");
    }
}


exports.getConfigValue = async(key) => {
    try {
    const rows = await db.query("SELECT value FROM config where key=$1", [key]);
    return rows;
    } catch(err) {
        console.log("Error in [getConfigValue]: ", err);
        throw new Error("Error in [getConfigValue]");
    }
}

exports.updateConfigValue = async(key, value) => {
    try {
    const rows = await db.query("UPDATE config SET value=$1 WHERE key=$2", [value, key]);
    return rows;
    } catch(err) {
        console.log("Error in [updateConfigValue]: ", err);
        throw new Error("Error in [updateConfigValue]");
    }
}

exports.getAllConfigs = async(key) => {
    try {
    const rows = await db.query("SELECT * FROM config");
    return rows;
    } catch(err) {
        console.log("Error in [getAllConfigs]: ", err);
        throw new Error("Error in [getAllConfigs]");
    }
}

exports.insertSwapTransaction = async (buyTx, sellTx, time, tradeamount, suibalanceinitial, suibalanceafterbuy, suibalanceaftersell, suilost) => {
    try {
        const rows = await db.query(
            "INSERT INTO swaptransactions (buytx, selltx, time, tradeamount, suibalanceinitial, suibalanceafterbuy, suibalanceaftersell, suilost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
            [buyTx, sellTx, time, tradeamount, suibalanceinitial, suibalanceafterbuy, suibalanceaftersell, suilost]
        );
        return rows;
    } catch (err) {
        console.error("Error in [insertSwapTransaction]:", err);
        throw new Error("Error in [insertSwapTransaction]");
    }
};

exports.insertSolanaSwapTransaction = async (contractData, transferData) => {
    try {
        const rows = await db.query(
            "INSERT INTO swaptransactions (swapbeforewsolbalance, swapbeforesolbalance, swapaftersolbalance, swaptxhash, transfertxhash) VALUES ($1, $2, $3, $4, $5)",
            [contractData?.beforeWsolBalance, contractData?.beforeSolBalance, contractData?.afterSolBalance, contractData?.txHash, transferData?.txHash]
        );
        return rows;
    } catch (err) {
        console.error("Error in [insertSolanaSwapTransaction]:", err);
        throw new Error("Error in [insertSolanaSwapTransaction]");
    }
};
