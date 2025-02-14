const fetch = require("node-fetch");
// const { getLiquidityV4PoolKeys } = require("../raydium_utils.js");
const { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Transaction, sendAndConfirmTransaction, AddressLookupTableProgram } = require("@solana/web3.js");
const { getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, createCloseAccountInstruction, TOKEN_PROGRAM_ID, createInitializeAccountInstruction, getAssociatedTokenAddress, createAssociatedTokenAccount } = require("@solana/spl-token");
const { connection, privateKey, wsolAddress, slippage, tax, connection2, getBatchSize } = require('../constants.js');
const { makeVersionedTransactionAndSign2, makeVersionedTransactionAndSign } = require("./transactionHelper.js");
// const { basicBundle, basicBundleJito } = require('../jito.js');
const { nu64, struct, u8 } = require('buffer-layout')
const crypto = require("crypto");
const bs58 = require("bs58");
const { Wallet } = require("@project-serum/anchor");
const anchor = require("@project-serum/anchor");
const { WSOL, Liquidity, jsonInfo2PoolKeys, Percent, Token, TokenAmount, poolKeys2JsonInfo, LIQUIDITY_STATE_LAYOUT_V4, MARKET_STATE_LAYOUT_V3, SPL_MINT_LAYOUT, MAINNET_PROGRAM_ID, Market, struct: structr } = require("@raydium-io/raydium-sdk");
const { BN } = require("bn.js");
const { publicKey } = require("@raydium-io/raydium-sdk");
const { basicBundleJito, getJitoTransferIx } = require("./jito.js");
const { getData, updateData, getSingleData } = require("../Repository/DBE/index.js");


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const retryAsync = async (fn, retries = 10, delayMs = 1000) => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt === retries - 1) throw error;
            console.log(`Retry attempt ${attempt + 1} after failure: ${error.message}`);
            await delay(delayMs);
        }
    }
};

async function getTokenInfo(tokenId) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        if (data?.pairs == null) {
            return;
        }
        const tokenData = data?.pairs[0];
        return tokenData.pairAddress;
    } catch (error) {
        console.error("Error fetching Token Info:", error.message);
    }
}
const MINIMAL_MARKET_STATE_LAYOUT_V3 = structr([
    publicKey("eventQueue"),
    publicKey("bids"),
    publicKey("asks"),
]);

async function getAmmPoolData(id) {
    try {
        const account = await connection.getAccountInfo(id);
        if (account === null) throw Error(" get id info error ");
        const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

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
            marketVersion: 3,
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

async function getAddressLookupTxIs(accounts, payer, feepayer) {
    const [ix, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
        authority: payer.publicKey,
        payer: feepayer.publicKey,
        recentSlot: await connection.getSlot(),
    });

    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
        lookupTable: lookupTableAddress,
        authority: payer.publicKey,
        payer: feepayer.publicKey,
        addresses: [
            TOKEN_PROGRAM_ID,
            accounts.id,
            accounts.authority,
            accounts.openOrders,
            accounts.baseVault,
            accounts.quoteVault,
            accounts.marketProgramId,
            accounts.marketId,
            accounts.marketBids,
            accounts.marketAsks,
            accounts.marketEventQueue,
            accounts.marketBaseVault,
            accounts.marketQuoteVault,
            accounts.marketAuthority,
        ],
    });

    return {
        ix: [ix, extendTableIx],
        lookupTableAddress: lookupTableAddress
    };
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
            tokenProgram: new anchor.web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),

        };
    }

    const poolKeys = await getAmmPoolData(new PublicKey(poolAddress));
    if (!poolKeys) {
        throw new Error("Invalid pool data")
    }
    return poolKeys;
}


const buySwap = async (accounts, amountLamp, minAmountLamp, wallet, derivedPubkey, originalOtherAccountAta) => {
    const keys = [
        { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
        { pubkey: accounts.id, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: false, isWritable: true },
        { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
        { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketProgramId, isSigner: false, isWritable: false },
        { pubkey: accounts.marketId, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBids, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAsks, isSigner: false, isWritable: true },
        { pubkey: accounts.marketEventQueue, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBaseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketQuoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAuthority, isSigner: false, isWritable: false },
        { pubkey: derivedPubkey, isSigner: false, isWritable: true },
        { pubkey: originalOtherAccountAta, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }
    ];


    // const amount = BigInt(amountLamp);  // Replace with the desired amount (in lamports)
    // const minAmount = BigInt(minAmountLamp);
    // const instructionData = Buffer.alloc(16);
    // instructionData.writeBigInt64LE(amount, 0);
    // instructionData.writeBigInt64LE(minAmount, 8);
    console.log(amountLamp)

    const dataLayout = struct([u8('instruction'), nu64('amountIn'), nu64('minAmountOut')])
    const data = Buffer.alloc(dataLayout.span)
    dataLayout.encode(
        {
            instruction: 9,
            amountIn: amountLamp,
            minAmountOut: minAmountLamp
        },
        data
    )
    return new TransactionInstruction({
        keys: keys,
        programId: accounts.programId,
        data: data
    });


}

const sellSwap = async (accounts, amountLamp, minAmountLamp, wallet, derivedPubkey, originalOtherAccountAta) => {
    const keys = [
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: accounts.id, isSigner: false, isWritable: true },
        { pubkey: accounts.authority, isSigner: false, isWritable: true },
        { pubkey: accounts.openOrders, isSigner: false, isWritable: true },
        { pubkey: accounts.baseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.quoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketProgramId, isSigner: false, isWritable: false },
        { pubkey: accounts.marketId, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBids, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAsks, isSigner: false, isWritable: true },
        { pubkey: accounts.marketEventQueue, isSigner: false, isWritable: true },
        { pubkey: accounts.marketBaseVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketQuoteVault, isSigner: false, isWritable: true },
        { pubkey: accounts.marketAuthority, isSigner: false, isWritable: false },
        { pubkey: originalOtherAccountAta, isSigner: false, isWritable: true },
        { pubkey: derivedPubkey, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true }
    ];


    // const amount = BigInt(amountLamp);  // Replace with the desired amount (in lamports)
    // const minAmount = BigInt(minAmountLamp);
    // const instructionData = Buffer.alloc(16);
    // instructionData.writeBigInt64LE(amount, 0);
    // instructionData.writeBigInt64LE(minAmount, 8);
    // console.log(amountLamp)

    const dataLayout = struct([u8('instruction'), nu64('amountIn'), nu64('minAmountOut')])
    const data = Buffer.alloc(dataLayout.span)
    dataLayout.encode(
        {
            instruction: 9,
            amountIn: amountLamp,
            minAmountOut: minAmountLamp
        },
        data
    )
    return new TransactionInstruction({
        keys: keys,
        programId: accounts.programId,
        data: data
    });


}

const buildTx = async (amount, payer, feepayer, poolKeys, otherAccountAddress) => {
    let instructions = [];

    ////////////////////////////////// BUY PROCESS ///////////////////////////////////////

    const seed = crypto.randomBytes(16).toString("hex");
    console.log("Generated Seed:", seed);

    const derivedPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        seed,
        TOKEN_PROGRAM_ID
    );
    console.log("Derived Address:", derivedPubkey);
    let amountWithRent = amount + 0.00203928 * LAMPORTS_PER_SOL;
    //TODO CHANGE THIS
    // console.log(amount)

    const transaction = new Transaction().add(
        SystemProgram.createAccountWithSeed({
            fromPubkey: payer.publicKey, // The funding account
            newAccountPubkey: derivedPubkey, // New derived account
            basePubkey: payer.publicKey, // Base key for derivation
            seed: seed, // Seed string (≤ 32 bytes)
            lamports: amountWithRent, // Rent-exempt balance
            space: 165, // Space for storing data
            programId: TOKEN_PROGRAM_ID, // Owned by the System Program
        }),
        createInitializeAccountInstruction(
            derivedPubkey,
            new PublicKey(wsolAddress),
            payer.publicKey
        )
    );

    instructions.push(SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey, // The funding account
        newAccountPubkey: derivedPubkey, // New derived account
        basePubkey: payer.publicKey, // Base key for derivation
        seed: seed, // Seed string (≤ 32 bytes)
        lamports: amountWithRent, // Rent-exempt balance
        space: 165, // Space for storing data
        programId: TOKEN_PROGRAM_ID, // Owned by the System Program
    }));
    instructions.push(createInitializeAccountInstruction(
        derivedPubkey,
        new PublicKey(wsolAddress),
        payer.publicKey
    ))

    console.log("Getting pool info");
    // console.log((poolKeys));
    // return;

    const poolInfo = await Liquidity.fetchInfo({ connection: connection, poolKeys: poolKeys });
    // console.log(poolInfo);
    // return
    // Step 3: swap
    const expectedData = Liquidity.computeAmountOut({
        poolKeys: jsonInfo2PoolKeys(poolKeys),
        poolInfo: poolInfo,
        amountIn: new TokenAmount(new Token(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), (poolKeys?.baseMint.toString() === wsolAddress ? poolKeys?.baseMint : poolKeys?.quoteMint), (poolKeys?.baseMint.toString() === wsolAddress ? poolKeys?.baseDecimals : poolKeys?.quoteDecimals)), new BN(amount.toString()), true),
        currencyOut: new Token(new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), (poolKeys?.baseMint.toString() === wsolAddress ? poolKeys?.quoteMint : poolKeys?.baseMint), (poolKeys?.baseMint.toString() === wsolAddress ? poolKeys?.quoteDecimals : poolKeys?.baseDecimals)),
        slippage: new Percent(new BN(slippage), new BN(100)),
    });
    const minAmountLamp = expectedData.minAmountOut.numerator.toString();


    const buyTxIx = await buySwap(poolKeys, amount, minAmountLamp, payer, derivedPubkey, otherAccountAddress);

    transaction.add(
        buyTxIx,
        createCloseAccountInstruction(
            derivedPubkey,
            payer.publicKey,
            payer.publicKey

        ),
        SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: feepayer.publicKey,
            lamports: Math.ceil(amount * (tax / 100))
        })
    )

    instructions.push(buyTxIx)
    instructions.push(createCloseAccountInstruction(
        derivedPubkey,
        payer.publicKey,
        payer.publicKey

    ))
    instructions.push(SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: feepayer.publicKey,
        lamports: Math.ceil(Number(tax)*LAMPORTS_PER_SOL)
        // lamports: Math.ceil(amount * (tax / 100))
    }))

    //Step 5: transfer fee

    ////////////////////////////////// SELL PROCESS ///////////////////////////////////////

    const seedSell = crypto.randomBytes(16).toString("hex");
    console.log("Generated Seed sell:", seedSell);

    const derivedPubkeySell = await PublicKey.createWithSeed(
        payer.publicKey,
        seedSell,
        TOKEN_PROGRAM_ID
    );
    console.log("Derived Address sell:", derivedPubkeySell.toBase58());
    const amountSell = 0.00203928 * LAMPORTS_PER_SOL;

    transaction.add(
        SystemProgram.createAccountWithSeed({
            fromPubkey: payer.publicKey, // The funding account
            newAccountPubkey: derivedPubkeySell, // New derived account
            basePubkey: payer.publicKey, // Base key for derivation
            seed: seedSell, // Seed string (≤ 32 bytes)
            lamports: amountSell, // Rent-exempt balance
            space: 165, // Space for storing data
            programId: TOKEN_PROGRAM_ID, // Owned by the System Program
        }),
        createInitializeAccountInstruction(
            derivedPubkeySell,
            new PublicKey(wsolAddress),
            payer.publicKey
        )
    );

    instructions.push(SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey, // The funding account
        newAccountPubkey: derivedPubkeySell, // New derived account
        basePubkey: payer.publicKey, // Base key for derivation
        seed: seedSell, // Seed string (≤ 32 bytes)
        lamports: amountSell, // Rent-exempt balance
        space: 165, // Space for storing data
        programId: TOKEN_PROGRAM_ID, // Owned by the System Program
    }));
    instructions.push(createInitializeAccountInstruction(
        derivedPubkeySell,
        new PublicKey(wsolAddress),
        payer.publicKey
    ))


    //Step 8: swap sell
    const sellTxIx = await sellSwap(poolKeys, minAmountLamp, 0, payer, derivedPubkeySell, otherAccountAddress);

    transaction.add(
        sellTxIx,
        createCloseAccountInstruction(
            derivedPubkeySell,
            payer.publicKey,
            payer.publicKey

        )
    );

    instructions.push(sellTxIx)
    instructions.push(createCloseAccountInstruction(
        derivedPubkeySell,
        payer.publicKey,
        payer.publicKey

    ));
    return instructions;

}

const volumeBundle = async (pairAddress, minAmount, maxAmount, bundleSize, payer, feepayer, poolKeys, otherAccountAddress, lookupTableAddress, lookupTableAccount) => {
    try {
        console.log("[volumeBundle]");

        function getRandomAmount(min, max) {
            return (Math.floor(Math.random() * (Number(max) - Number(min) + 1)) + Number(min));
        }

        const amounts = Array.from({ length: bundleSize }, () => getRandomAmount(minAmount, maxAmount));

        // const promises = Array.from({ length: bundleSize }, (_, index) => buildTx(minAmount, maxAmount, payer, feepayer, poolKeys, otherAccountAddress));
        const promises = amounts.map((amount, index) => buildTx(amount, payer, feepayer[index % feepayer.length], poolKeys, otherAccountAddress));
        const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
        const [jitoIx, recentBlockhashForSwap] = await Promise.all([getJitoTransferIx(payer), connection2.getLatestBlockhash()]);
        const instructions = await Promise.all(promises);
        instructions[0].push(jitoIx);
        console.log("executing");

        const txns = await Promise.all(
            instructions.map((ix, index) => makeVersionedTransactionAndSign2(
                ix,
                feepayer[index % feepayer.length],
                recentBlockhashForSwap.blockhash,
                [feepayer[index % feepayer.length], payer],
                lookupTableAccount
            ))
        );
        await basicBundleJito(txns);

        // for (let i = 0; i < bundleSize; i++) {
        //     const instructions = await buildTx(minAmount, maxAmount, payer, feepayer, poolKeys, otherAccountAddress);

        //     //Step 11: jitotip

        //     console.log("Getting jito transfer ix");
        //     instructions.push(await getJitoTransferIx(payer));



        //     console.log("Executing!");
        //     // Send the transaction to create the account
        //     // await anchor.web3.sendAndConfirmTransaction(connection2, transaction, [payer]);


        //     const recentBlockhashForSwap = await retryAsync(() => connection2.getLatestBlockhash());
        //     const tx = await retryAsync(() => makeVersionedTransactionAndSign2(
        //         instructions,
        //         feepayer,
        //         recentBlockhashForSwap.blockhash,
        //         [feepayer, payer],
        //         lookupTableAccount
        //     ));
        //     await basicBundleJito([tx]);


        //     // // Set the recentBlockhash in the transaction
        //     // transaction.recentBlockhash = blockhash;
        //     // transaction.sign(feepayer)
        //     // transaction.partialSign(payer);
        //     // const txId = await connection.sendRawTransaction(transaction.serialize());
        //     // // await connection.confirmTransaction(txId);
        //     // console.log(txId)


        // }

        return totalAmount + Number((totalAmount - (totalAmount * (slippage / 100))).toFixed(2));

    } catch (err) {
        console.log("Error in [volumeBundle]: ", err);
        throw new Error(err);
    }
}

// volumeBundle("9sb2cMvDid8hbnbGMwQC62TVTVDAdTH8aqTYfXCfH5QF", 10000000, 20000000, 1)



// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runVolumeBot = async (token, minAmount, maxAmount, transactionsPerMinute, secretKey, targetVolumeInSol, launchId) => {
    try {
        const batchSize = getBatchSize(transactionsPerMinute);
        console.log(`LaunchID: ${launchId}, batchSize : ${batchSize}`);

        const numberOfBatches = Math.floor(transactionsPerMinute / batchSize);
        const delayTime = parseInt(60 / numberOfBatches) * 1000; // Convert to milliseconds

        console.log(`Number of Batches: ${numberOfBatches}, Delay Time: ${delayTime}ms`);

        // const payer = Keypair.fromSecretKey(bs58.default.decode(secretKey));
        const payer = Keypair.fromSecretKey(Buffer.from(secretKey, "hex"));

        const payerWallets = await getData({ isactive: true }, "sol_payer_wallet");
        // console.log(payer, payerWallets);
        //todo update bot to stop
        if (!payerWallets?.length) throw new Error("No active payer wallet found.");
        // const feePayerArray = [payerWallets];

        const OTHER_MINT_ADDRESS = new PublicKey(token);
        // other account details
        const otherAccountAddress = await getAssociatedTokenAddress(OTHER_MINT_ADDRESS, payer.publicKey, false);
        const [accountDetails, recentBlock, jitoTx] = await Promise.all([connection.getAccountInfo(otherAccountAddress, 'confirmed'), connection2.getLatestBlockhash(), getJitoTransferIx(payer)]);
        const initialTx = new Transaction();
        // let initalIxs = [];

        if (!accountDetails) {
            console.log("Creating associated token account");
            const ix1 = createAssociatedTokenAccountIdempotentInstruction(
                payer.publicKey,
                otherAccountAddress,
                payer.publicKey,
                OTHER_MINT_ADDRESS

            )
            // TODO
            initialTx.add(
                ix1
            );
            // initalIxs.push(ix1);
            // console.log(tx)
            // await sendAndConfirmTransaction(connection2, initialTx, [feepayer, payer]); //todo remove this later when adddress lookup table code is uncommented

        }

        const pairAddress = await getTokenInfo(token);
        if (!pairAddress) throw new Error("Could not find token pair address");

        const poolKeys = await getPoolData(pairAddress, connection);
        if (!poolKeys) throw new Error("Cannot find pool data");

        const addressLookupTxIx = await getAddressLookupTxIs(poolKeys, payer, payer);

        initialTx.add(addressLookupTxIx?.ix[0], addressLookupTxIx?.ix[1], jitoTx);
        // initalIxs.push(addressLookupTxIx?.ix[0]);
        // initalIxs.push(addressLookupTxIx?.ix[1]);
        // initalIxs.push(jitoTx);
        console.log("Sending initial tx");
        // const finalInitialTxns = await makeVersionedTransactionAndSign(
        //     initalIxs,
        //     payer,
        //     recentBlock.blockhash,
        //     [payer]
        // );
        initialTx.recentBlockhash = recentBlock.blockhash;
        initialTx.feePayer = payer.publicKey;
        initialTx.sign(payer);
        const serializedTransaction = initialTx.serialize({ verifySignatures: false });
        const base58EncodedTransaction = bs58.default.encode(serializedTransaction);

        await basicBundleJito([base58EncodedTransaction]);
        // console.log(await sendAndConfirmTransaction(connection2, initialTx, [payer]));

        console.log("Geting lookup table data");
        let lookupTableAccount;
        let flag = true;
        while (flag) {
            lookupTableAccount = await connection2.getAddressLookupTable(addressLookupTxIx?.lookupTableAddress)
                .then(async(res) => {
                    if(!res?.value) {
                        await sleep(2000);
                        return;
                    }
                    flag = false;
                    return res.value;
                })
                .catch(async(err) => {
                    console.error("Failed to fetch lookup table:", err);
                    await sleep(2000);
                    return null;
                });
        }
        if (!lookupTableAccount)
            throw new Error("Lookup table not found on-chain. Ensure it's created and confirmed.");

        let count = 0;
        let achievedVolume = 0;
        let totalTransactionCount = 0;

        console.log("Running volume Bot...");
        while (true) {
            // console.log(payerWallets)
            let currentFeePayers = []
            for (let k = 0; k < batchSize; k++) {
                currentFeePayers.push(Keypair.fromSecretKey(Buffer.from(payerWallets[count % payerWallets.length]?.secretkey, "hex")));
                count += 1;
            }
            // console.log(batchSize, currentFeePayers);
            // return;
            // const currentFeePayer = feePayerArray[count % feePayerArray.length];

            let volume = await volumeBundle(pairAddress, minAmount, maxAmount, batchSize, payer, currentFeePayers, poolKeys, otherAccountAddress, addressLookupTxIx?.lookupTableAddress, lookupTableAccount);
            count += 1;
            achievedVolume += volume;
            totalTransactionCount += batchSize;

            // Check bot status from DB
            const botLaunchDetails = await getSingleData({ id: launchId }, "sol_bot_details");
            if (achievedVolume > targetVolumeInSol || botLaunchDetails?.status === "ForceStop") {
                console.log("Stopping bot...");

                await updateData({
                    achievedvolume: achievedVolume,
                    totaltransactioninitiated: totalTransactionCount,
                    currentbatchnumber: count,
                    status: botLaunchDetails?.status === "ForceStop" ? botLaunchDetails?.status : "TargetAchieved"
                },
                    { id: launchId },
                    "sol_bot_details");

                break;
            }

            console.log(`Sleeping for ${delayTime / 1000} seconds...`);
            await sleep(delayTime); // Add delay
        }

        console.log("[Done]");
    } catch (error) {
        console.error(error);
        const upRes = await updateData({ status: "StoppedWithError" }, { id: launchId }, "sol_bot_details");
        console.log(upRes);
        throw new Error("Something went wrong");
    }
}


module.exports = {
    getTokenInfo,
    runVolumeBot
}
