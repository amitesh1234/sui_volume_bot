const { Wallet } = require('@project-serum/anchor');
const {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    LAMPORTS_PER_SOL
} = require("@solana/web3.js");
const bs58 = require("bs58");
const { Liquidity, jsonInfo2PoolKeys, LIQUIDITY_STATE_LAYOUT_V4, MAINNET_PROGRAM_ID, publicKey, struct, Market,
    MARKET_STATE_LAYOUT_V3 } = require("@raydium-io/raydium-sdk");
const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
    publicKey("eventQueue"),
    publicKey("bids"),
    publicKey("asks"),
]);
const { BN } = require("bn.js");

const {
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress,
    createTransferInstruction,
    createCloseAccountInstruction,
    getAccount
} = require("@solana/spl-token");
const anchor = require('@project-serum/anchor');
const database = require("./db/pg");
const { getAllConfigs, getActiveWallet, updateInactiveWallets, insertActiveWallet, insertSolanaSwapTransaction } = require('./db/dbQueries');
const axios = require("axios");

// const bs58 = require("bs58");


const programId = new anchor.web3.PublicKey('5ecDHQbuSzEGsGgJDGHCqHLVoSsL87yaPkLAfQLEYxUc');
// const programId = new anchor.web3.PublicKey('CZhYxJXG2nqfbb3Tvr9sBFiJkkQSYCNcnr349fzsW4RB');
// const connection = new Connection('https://devnet.helius-rpc.com/?api-key=0277805e-5795-4286-8344-8616f4578bf8', 'confirmed');
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// const privateKey = "3dQodb2qUkmAzNvLzfBuSGqFHWV3yM95BZGDyeVKBp3uA3PqxZXc1hoR6bYsy6GshAUia36bTqitfLkQZHp9gpLs";
// const secretKey = bs58.default.decode(privateKey);
// const keypair = Keypair.fromSecretKey(secretKey)
// const wallet = new Wallet(keypair);

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAmmPoolData(id, connection) {
    try {
        const account = await connection.getAccountInfo(id, "confirmed");
        if (account === null) throw Error(" get id info error ");
        const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

        if (poolInfo.baseMint.toBase58() != Token.WSOL.mint.toBase58() && poolInfo.quoteMint.toBase58() != Token.WSOL.mint.toBase58()) {
            return null;
        }

        const marketId = info.marketId;
        const marketAccount_minimal = await connection.getAccountInfo(marketId, {
            commitment: "confirmed",
            dataSlice: {
                offset: MARKET_STATE_LAYOUT_V3.offsetOf("eventQueue"),
                length: 32 * 3,
            },
        });
        const marketAccount = await connection.getAccountInfo(marketId);
        if (marketAccount === null || marketAccount_minimal === null) {
            throw Error(" get market info error");

        }
        const marketInfo_minimal = MINIMAL_MARKET_STATE_LAYOUT_V3.decode(
            marketAccount_minimal.data
        );
        const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
        const lpMint = info.lpMint;
        const lpMintAccount = await connection.getAccountInfo(lpMint);
        if (lpMintAccount === null) {
            throw Error(" get lp mint info error");
        }

        let lpMintInfo;
        try {
            lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);
        } catch (err) {
            lpMintInfo = new BN(9);
        }
        return {
            id: id,
            baseMint: info.baseMint,
            quoteMint: info.quoteMint,
            lpMint: info.lpMint,
            baseDecimals: info.baseDecimal.toNumber(),
            quoteDecimals: info.quoteDecimal.toNumber(),
            lpDecimals: lpMintInfo.decimals,
            version: 4,
            programId: MAINNET_PROGRAM_ID.AmmV4,
            authority: Liquidity.getAssociatedAuthority({
                programId: MAINNET_PROGRAM_ID.AmmV4,
            }).publicKey,
            openOrders: info.openOrders,
            targetOrders: info.targetOrders,
            baseVault: info.baseVault,
            quoteVault: info.quoteVault,
            withdrawQueue: info.withdrawQueue,
            lpVault: info.lpVault,
            marketVersion: 4,
            marketProgramId: info.marketProgramId,
            marketId: info.marketId,
            marketAuthority: Market.getAssociatedAuthority({
                programId: info.marketProgramId,
                marketId: info.marketId,
            }).publicKey,
            marketBaseVault: marketInfo.baseVault,
            marketQuoteVault: marketInfo.quoteVault,
            marketBids: marketInfo_minimal.bids,
            marketAsks: marketInfo_minimal.asks,
            marketEventQueue: marketInfo_minimal.eventQueue,
            lookupTableAccount: PublicKey.default
        }
    } catch (err) {
        console.log("Error in fetching market data: ", err);
    }
}

const getPoolData = async (poolAddress, connection, isDev) => {
    if (isDev) {
        return {
            programId: new anchor.web3.PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"),
            id: new anchor.web3.PublicKey("2Vo5hFVcq8pytxTTiTE9j5GGTd4GXLY4fdcaYgQVf3sJ"),
            authority: new anchor.web3.PublicKey("DbQqP6ehDYmeYjcBaMRuA8tAJY1EjDUz9DpwSLjaQqfC"),
            openOrders: new anchor.web3.PublicKey("7JvFBX9fUARprgBJoT7KbQ1ZFkaaeEa7WgZKLLC5G9HN"),
            baseVault: new anchor.web3.PublicKey("fF5NiugPwCssTC5SHUuHRDT7d86sMMpgqDPc9dtaJp9"),
            quoteVault: new anchor.web3.PublicKey("8YVcZRhnULAHZrfNT3mE3kXc9vtqGT2PqEBY5Y5Ar9jM"),
            marketProgramId: new anchor.web3.PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
            marketId: new anchor.web3.PublicKey("GkMSQ2c9h8mWPZKsX27sGkU814kmyAdnUGYLACcofGpy"),
            marketBids: new anchor.web3.PublicKey("62E17kFgFfNK5KQtFUcfVd3PN7UxtDc8PcMGGL62EK9W"),
            marketAsks: new anchor.web3.PublicKey("GJ38XekjRSXHdxre7sBNboxVMAxkCtzqCESvrFkZiA4p"),
            marketEventQueue: new anchor.web3.PublicKey("GrKCNHfd765wvSX1F6xH54aD9tADbynMxZuFEKosnE5W"),
            marketBaseVault: new anchor.web3.PublicKey("2mMc6kahAdtrHpC3db8tBTbanz58XfvQupaKW9dGPmze"),
            marketQuoteVault: new anchor.web3.PublicKey("CzCS8rtoRdYgG3tSoPacQLiZz15RJDVYeqPvu84wkbqB"),
            marketAuthority: new anchor.web3.PublicKey("D33nf1ed4jKPn8cJNwty2Bete5ZtgWVVCQpTupSuSGA9"),
            tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
        };
    }
    const poolKeys = await getAmmPoolData(new PublicKey(poolAddress), connection);
    // console.log(poolKeys)
    if (!poolKeys) {
        throw new Error("Invalid pool data")
    }
    // let poolInfo = await Liquidity.fetchInfo({ connection: connection, poolKeys: poolKeys });
    // console.log(poolInfo);
    return poolKeys;

}

const swap = async (wallet, keypair, newAccount, config, accounts) => {
    // const WSOL_MINT_ADDRESS = new PublicKey('So11111111111111111111111111111111111111112');
    // const OTHER_MINT_ADDRESS = new PublicKey('B1MT8QhtASfV35g1aBRAcqVv1YpgNRMPNqYEBFzzgq8o');
    const WSOL_MINT_ADDRESS = new PublicKey(config?.solanaTokenAddress);

    const time = (Math.floor(Math.random() * (Number(config?.maxNewTradeTime) - Number(config?.minNewTradeTime) + 1)) + Number(config?.minNewTradeTime)) * 1000;
    console.log(`Sleeping for ${time}`);

    await sleep(time);
    console.log(`Initiating Swaps on both sides for wallet: ${wallet.publicKey}`);

    const tradeAmount = (Math.floor(Math.random() * (Number(config?.maxTradeAmount) * 10 ** Number(config?.aolanaTokenDecimals) - Number(config?.minTradeAmount) * 10 ** Number(config?.aolanaTokenDecimals) + 1)) + Number(config?.minTradeAmount) * 10 ** Number(config?.aolanaTokenDecimals));

    const OTHER_MINT_ADDRESS = new PublicKey(config?.otherTokenAddress);

    // console.log(wallet.publicKey, WSOL_MINT_ADDRESS)
    const originalWsolAta = await getAssociatedTokenAddress(WSOL_MINT_ADDRESS, wallet.publicKey, false);
    const originalOtherAccountAta = await getAssociatedTokenAddress(OTHER_MINT_ADDRESS, wallet.publicKey, false);

    // return;
    // const accounts = {
    //     ammProgram: new anchor.web3.PublicKey("HWy1jotHpo6UqeQxx49dpYYdQB8wj9Qk9MdxwjLvDHB8"),
    //     amm: new anchor.web3.PublicKey("2Vo5hFVcq8pytxTTiTE9j5GGTd4GXLY4fdcaYgQVf3sJ"),
    //     ammAuthority: new anchor.web3.PublicKey("DbQqP6ehDYmeYjcBaMRuA8tAJY1EjDUz9DpwSLjaQqfC"),
    //     ammOpenOrders: new anchor.web3.PublicKey("7JvFBX9fUARprgBJoT7KbQ1ZFkaaeEa7WgZKLLC5G9HN"),
    //     ammCoinVault: new anchor.web3.PublicKey("fF5NiugPwCssTC5SHUuHRDT7d86sMMpgqDPc9dtaJp9"),
    //     ammPcVault: new anchor.web3.PublicKey("8YVcZRhnULAHZrfNT3mE3kXc9vtqGT2PqEBY5Y5Ar9jM"),
    //     marketProgram: new anchor.web3.PublicKey("EoTcMgcDRTJVZDMZWBoU6rhYHZfkNTVEAfz3uUJRcYGj"),
    //     market: new anchor.web3.PublicKey("GkMSQ2c9h8mWPZKsX27sGkU814kmyAdnUGYLACcofGpy"),
    //     marketBids: new anchor.web3.PublicKey("62E17kFgFfNK5KQtFUcfVd3PN7UxtDc8PcMGGL62EK9W"),
    //     marketAsks: new anchor.web3.PublicKey("GJ38XekjRSXHdxre7sBNboxVMAxkCtzqCESvrFkZiA4p"),
    //     marketEventQueue: new anchor.web3.PublicKey("GrKCNHfd765wvSX1F6xH54aD9tADbynMxZuFEKosnE5W"),
    //     marketCoinVault: new anchor.web3.PublicKey("2mMc6kahAdtrHpC3db8tBTbanz58XfvQupaKW9dGPmze"),
    //     marketPcVault: new anchor.web3.PublicKey("CzCS8rtoRdYgG3tSoPacQLiZz15RJDVYeqPvu84wkbqB"),
    //     marketVaultSigner: new anchor.web3.PublicKey("D33nf1ed4jKPn8cJNwty2Bete5ZtgWVVCQpTupSuSGA9"),
    //     wsolAccount: originalWsolAta,
    //     otherTokenAccount: originalOtherAccountAta,
    //     soucePublicKey: wallet.publicKey,
    //     tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    //     // next_account: new anchor.web3.PublicKey(wallet.publicKey.toBase58()),
    //     // next_account_wsol: wsolAta,
    //     // wsol_mint: new anchor.web3.PublicKey("So11111111111111111111111111111111111111112"),
    //     // system_program: new anchor.web3.PublicKey("11111111111111111111111111111111"),
    //     // rent: new anchor.web3.PublicKey("SysvarRent111111111111111111111111111111111")

    // };

    // const keys = [
    //     { pubkey: accounts.ammProgram, isSigner: false, isWritable: false },
    //     { pubkey: accounts.amm, isSigner: false, isWritable: true },
    //     { pubkey: accounts.ammAuthority, isSigner: false, isWritable: true },
    //     { pubkey: accounts.ammOpenOrders, isSigner: false, isWritable: true },
    //     { pubkey: accounts.ammCoinVault, isSigner: false, isWritable: true },
    //     { pubkey: accounts.ammPcVault, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketProgram, isSigner: false, isWritable: true },
    //     { pubkey: accounts.market, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketBids, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketAsks, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketEventQueue, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketCoinVault, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketPcVault, isSigner: false, isWritable: true },
    //     { pubkey: accounts.marketVaultSigner, isSigner: false, isWritable: true },
    //     { pubkey: accounts.wsolAccount, isSigner: false, isWritable: true },
    //     { pubkey: accounts.otherTokenAccount, isSigner: false, isWritable: true },
    //     { pubkey: accounts.soucePublicKey, isSigner: true, isWritable: true },
    //     { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
    //     // { pubkey: accounts.next_account, isSigner: false, isWritable: true },
    //     // { pubkey: accounts.next_account_wsol, isSigner: false, isWritable: true },
    //     // { pubkey: accounts.wsol_mint, isSigner: false, isWritable: true },
    //     // { pubkey: accounts.system_program, isSigner: false, isWritable: true },
    //     // { pubkey: accounts.rent, isSigner: false, isWritable: true },
    // ];

    const keys = [
        { pubkey: accounts.programId, isSigner: false, isWritable: false },
        { pubkey: accounts.id, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: false, isWritable: true },
        { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
        { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketProgramId, isSigner: false, isWritable: true },
        { pubkey: accounts.marketId, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBids, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAsks, isSigner: false, isWritable: true },
        { pubkey: accounts.marketEventQueue, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBaseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketQuoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAuthority, isSigner: false, isWritable: true },
        { pubkey: originalWsolAta, isSigner: false, isWritable: true },
        { pubkey: originalOtherAccountAta, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: accounts.tokenProgram, isSigner: false, isWritable: false },
        // { pubkey: accounts.next_account, isSigner: false, isWritable: true },
        // { pubkey: accounts.next_account_wsol, isSigner: false, isWritable: true },
        // { pubkey: accounts.wsol_mint, isSigner: false, isWritable: true },
        // { pubkey: accounts.system_program, isSigner: false, isWritable: true },
        // { pubkey: accounts.rent, isSigner: false, isWritable: true },
    ];

    const amount = BigInt(10000000);  // Replace with the desired amount (in lamports)
    const minAmount = BigInt(0);
    const instructionData = Buffer.alloc(16);
    instructionData.writeBigInt64LE(amount, 0);
    instructionData.writeBigInt64LE(minAmount, 8);
    console.log("Building")
    const tx = new anchor.web3.Transaction();
    tx.add(new TransactionInstruction({
        keys: keys,
        programId: programId,
        data: instructionData
    }));

    console.log("Step 2");

    const wsolAta = await getAssociatedTokenAddress(WSOL_MINT_ADDRESS, new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), false);

    const createAccountInstructionWsol = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer who creates the account
        wsolAta,         // Associated token account for WSOL
        new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), // Owner of the associated token account
        WSOL_MINT_ADDRESS // WSOL mint address
    )
    const otherAta = await getAssociatedTokenAddress(OTHER_MINT_ADDRESS, new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), false);

    const createAccountInstructionOther = createAssociatedTokenAccountInstruction(
        wallet.publicKey, // Payer who creates the account
        otherAta,         // Associated token account for WSOL
        new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), // Owner of the associated token account
        OTHER_MINT_ADDRESS // WSOL mint address
    )
    tx.add(createAccountInstructionWsol);
    tx.add(createAccountInstructionOther);

    console.log("Step 3");

    const balance = await getAccount(connection, originalWsolAta);
    // console.log(balance);
    const originalBalance = await connection.getBalance(wallet.publicKey);
    console.log(originalBalance);
    if (Number(balance.amount) < (Number(config?.maxTradeAmount) + Number(config?.solAmountToBalanceBuffer)) * 10 ** Number(config?.solanaTokenDecimals)) {
        throw new Error("Wsol Balance has gone below max trade value plus buffer");
    }

    if (Number(balance.amount) < (Number(config?.minSolBalance)) * 10 ** Number(config?.solanaTokenDecimals)) {
        throw new Error("Wsol Balance has gone below max trade value plus buffer");
    }

    // return;
    //todo check this rent exemption required?
    const rentExemptMinimum = BigInt(2039280);
    // const rentExemptMinimum = BigInt(5000);

    // console.log(balance)
    const transferInstruction = createTransferInstruction(originalWsolAta, wsolAta, wallet.publicKey, balance.amount - rentExemptMinimum, [], TOKEN_PROGRAM_ID);
    const closeInstruction = createCloseAccountInstruction(originalWsolAta, wallet.publicKey, wallet.publicKey, [], TOKEN_PROGRAM_ID);

    tx.add(transferInstruction);
    tx.add(closeInstruction);

    console.log("executing")
    const txSignature = await anchor.web3.sendAndConfirmTransaction(connection, tx, [keypair]); // Ensure you include your signer

    console.log('Transaction signature:', txSignature);
    // const afterBalance = await getAccount(connection, originalWsolAta);
    const afterOriginalBalance = await connection.getBalance(wallet.publicKey);
    return {
        beforeWsolBalance: Number(balance?.amount) / LAMPORTS_PER_SOL,
        beforeSolBalance: originalBalance / LAMPORTS_PER_SOL,
        afterSolBalance: afterOriginalBalance / LAMPORTS_PER_SOL,
        txHash: txSignature,
        afterSolBalanceLamports: afterOriginalBalance
    }
}

// swap()


const transferEverything = async (wallet, keypair, newAccount, originalBalance) => {
    // const ex = await connection.getMinimumBalanceForRentExemption(anchor.web3.NONCE_ACCOUNT_LENGTH);
    // console.log(ex)
    // const originalBalance = await connection.getBalance(wallet.publicKey);
    // console.log(originalBalance)
    console.log("[transferEverything]");
    // console.log(originalBalance)

    const transferInstruction = anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new anchor.web3.PublicKey(newAccount.publicKey.toBase58()),
        lamports: Number(originalBalance) - 5000, // Transfer everything except the rent-exempt minimum
    });
    const transaction = new anchor.web3.Transaction().add(transferInstruction);

    // transaction.add(createCloseAccountInstruction(wallet.publicKey, new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), wallet.publicKey, [], new anchor.web3.PublicKey("11111111111111111111111111111111")));
    const txSignature = await anchor.web3.sendAndConfirmTransaction(connection, transaction, [keypair]); // Ensure you include your signer

    console.log('Transaction signature:', txSignature);
    // const afterOriginalBalance = await connection.getBalance(wallet.publicKey);


    return {
        txHash: txSignature
    }
}

const fullLoop = async (mainWallet, config, poolKeys) => {
    const newAccount = Keypair.generate();
    console.log(newAccount.publicKey.toBase58())
    console.log(bs58.default.encode(newAccount.secretKey));

    const keypair = Keypair.fromSecretKey(bs58.default.decode(mainWallet?.privatekey));
    const wallet = new Wallet(keypair);

    //todo update this data
    //todo make account data dynamic
    const contractData = await swap(wallet, keypair, newAccount, config, poolKeys);
    const transferData = await transferEverything(wallet, keypair, newAccount, contractData?.afterSolBalanceLamports);
    await insertSolanaSwapTransaction(contractData, transferData);
    await updateInactiveWallets();
    await insertActiveWallet(newAccount.publicKey.toBase58(), bs58.default.encode(newAccount.secretKey));


    return {
        publickey: newAccount.publicKey.toBase58(),
        privatekey: bs58.default.encode(newAccount.secretKey)
    }
}


const startProcess = async () => {
    console.log("[Initializing]");

    const mainWalletJson = await getActiveWallet();
    console.log(mainWalletJson.length);
    if (mainWalletJson.length <= 0) {
        throw new Error("No active wallets");
    }
    let mainWallet = mainWalletJson[0];

    if (!mainWallet?.isactive) {
        throw new Error("No main Wallet is Active");
    }
    const dbConfigs = await getAllConfigs();
    if (dbConfigs.length <= 0) {
        throw new Error("No active config");
    }

    let dbJson = dbConfigs.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {});

    let globalCount = 0;
    let globalRecursionCount = Number(dbJson?.globalRecursionCount);
    const poolKeys = await getPoolData(dbJson?.poolAddress, connection, true);
    while (globalCount < globalRecursionCount) {
        while (dbJson?.status === '0') {
            console.log("Config is paused, Waiting 1 min");
            await sleep(60000);
        }
        console.log("Initiating Swaps");

        const updatedData = await fullLoop(mainWallet, dbJson, poolKeys)
        console.log("Done");
        // await sleep(5000);

        globalCount++;

        mainWallet = updatedData;
        const dbConfigs2 = await getAllConfigs();
        if (dbConfigs2.length <= 0) {
            throw new Error("No active config");
        }
        dbJson = dbConfigs2.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});
        // globalRecursionCount = Number(dbJson?.globalRecursionCount);
        if (Number(dbJson?.globalRecursionCount) === 9999) {
            globalRecursionCount += 1;
        } else {
            globalRecursionCount = Number(dbJson?.globalRecursionCount);
        }


    }
}


const main = async () => {
    try {
        await database.initialize();
        await startProcess();
    } catch (err) {
        console.log(err);
    }
}

main()


// getPoolData();