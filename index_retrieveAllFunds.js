const { createSignerWithSecretKey } = require("./cetus/keypair.js");
const { swap } = require("./cetus/swap.js");
const { getBalance, transfer } = require("./cetus/utils.js");
const { getAllConfigs } = require("./db/dbQueries.js");
const database = require("./db/pg.js");
const BigNumber = require("bignumber.js");

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const getConfig = async () => {
    const dbConfigs = await getAllConfigs();
    if (dbConfigs.length <= 0) {
        throw new Error("No active config");
    }
    let dbJson = dbConfigs.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {});
    return dbJson;
}
const subtractBigNumber = (x, y) => new BigNumber(x).minus(new BigNumber(y)).toString();

const collectFunds = async () => {
    const config = await getConfig();
    console.log(config);
    const activeWallet = await database.query("Select * from wallets where isactive=true");
    console.log(activeWallet);
    if (activeWallet.length <= 0) {
        throw new Error("No active wallet to collect funds");
    }

    let walletstoProcess = [];
    let count = 0;
    while (true) {
        walletstoProcess = await database.query("Select * from wallets LIMIT 10 OFFSET $1", [count]);

        count += 10;
        for (let wallet of walletstoProcess) {
            // console.log(wallet)
            const [nativeTokenBalance, otherTokenBalance] = await Promise.all([getBalance(wallet?.publickey, config?.suiTokenAddress), getBalance(wallet?.publickey, config?.otherTokenAddress)]);
            // if (otherTokenBalance > 0) {
            //     try {
            //         const signer = createSignerWithSecretKey(wallet?.privatekey);
            //         const sellTx = await swap(config?.poolAddress, otherTokenBalance, Number(config?.slippage), config?.otherTokenAddress, false, signer, wallet?.publickey, otherTokenBalance, nativeTokenBalance, config);
            //         console.log("Swap: ", sellTx)
            //         await sleep(1000);
            //     } catch (err) {
            //         console.log("Error in swapping", err);
            //     }
            // }

            if (nativeTokenBalance > 3500000) {
                tx = await transfer(wallet?.publickey, activeWallet[0]?.publickey, config?.suiTokenAddress, Number(subtractBigNumber(nativeTokenBalance.toString(), config?.transferGasFee.toString())), createSignerWithSecretKey(wallet?.privatekey));
                console.log("Transfer: ", tx);
            }

        }

        if (walletstoProcess.length <= 0) {
            console.log("Done");
            break;
        }
    }

}

const main = async () => {
    try {
        await database.initialize();
        await collectFunds();
    } catch (err) {
        console.log(err);
    }
}
main()