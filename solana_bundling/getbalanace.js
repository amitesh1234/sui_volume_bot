const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { connection3, connection2 } = require("../constants");
const { createData, getSingleData } = require("../Repository/DBE");
const bs58 = require("bs58");
const { getJitoTransferIx, basicBundleJito } = require("./jito");
// Initialize a connection to the Solana blockchain
// const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// Function to check the balance of a Solana wallet
const getSolanaBalance = async (publicKey) => {
    try {
        const walletAddress = new PublicKey(publicKey);
        const balance = await connection2.getBalance(walletAddress);
        console.log(`Balance for address ${publicKey}: ${balance / LAMPORTS_PER_SOL} SOL`);
        return (balance / LAMPORTS_PER_SOL).toString();
    } catch (error) {
        console.error("Error checking balance:", error);
        return null;
    }
};

// Function to generate a new Solana wallet
const generateWallet = () => {
    try {
        const keypair = Keypair.generate();
        const publicKey = keypair.publicKey.toString();
        const secretKey = Buffer.from(keypair.secretKey).toString("hex"); // Use HEX format for safer storage

        console.log("New Wallet Generated:");
        // console.log("Public Key:", publicKey);
        // console.log("Secret Key (DO NOT SHARE):", secretKey);

        return { publicKey, secretKey, keypair };
    } catch (error) {
        console.error("Error generating wallet:", error);
        return null;
    }
};

// TODO
// sending userid instead of userid
const withdrawAll = async (userId, newAccount) => {

    // TODO get wallet info from db
    const wallet = await getSingleData({ userid: userId }, "sol_wallet");
    if (!wallet) throw new Error("wallet not found.");
    const keypair = Keypair.fromSecretKey(Buffer.from(wallet?.secretkey, 'hex'));

    const [balance, recentBlock, jitoTx] = await Promise.all([getSolanaBalance(wallet.publickey), connection2.getLatestBlockhash(), getJitoTransferIx(keypair)]);
    console.log("[transferEverything]");
    // console.log(originalBalance)
    if (Number(balance * LAMPORTS_PER_SOL) - 5000 < 0) {
        return {
            success: false,
            txHash: "",
            message: "Balance is very low for withdrawal!"
        }
    }
    // return

    const transferInstruction = SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(newAccount),
        lamports: Number(balance * LAMPORTS_PER_SOL) - 5000, // Transfer everything except the rent-exempt minimum
    });
    const transaction = new Transaction().add(transferInstruction, jitoTx);
    transaction.recentBlockhash = recentBlock.blockhash;
    transaction.feePayer = keypair.publicKey;
    transaction.sign(keypair);

    const serializedTransaction = transaction.serialize({ verifySignatures: false });
    const base58EncodedTransaction = bs58.default.encode(serializedTransaction);
    await basicBundleJito([base58EncodedTransaction]);

    // const txSignature = await sendAndConfirmTransaction(connection2, transaction, [keypair]); // Ensure you include your signer
    // TODO IN UPPER CODE [wallet]
    // console.log('Transaction signature:', txSignature);
    // const afterOriginalBalance = await connection.getBalance(wallet.publicKey);

    // TODO createWithdrawalData
    await createData({
        userid: userId,
        txhash: txSignature,
        topublickey: newAccount,
        frompublickey: wallet.publickey
    }, "sol_withdraw")

    return {
        success: true
    }
}

// withdrawAll("1931998570", "C2ReeJZNxbGDXciXGo1zQiyjSsmxNTK2b36iigcPQreU")
module.exports = {
    getSolanaBalance,
    generateWallet,
    withdrawAll
};
