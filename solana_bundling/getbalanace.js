const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { connection3, connection2 } = require("../constants");

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


const withdrawAll = async (wallet, newAccount) => {
    const balance = getSolanaBalance(wallet.publicKey.toString());
    console.log("[transferEverything]");
    // console.log(originalBalance)

    const transferInstruction = SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: new PublicKey(newAccount),
        lamports: Number(balance*LAMPORTS_PER_SOL) - 5000, // Transfer everything except the rent-exempt minimum
    });
    const transaction = new Transaction().add(transferInstruction);

    // transaction.add(createCloseAccountInstruction(wallet.publicKey, new anchor.web3.PublicKey(newAccount.publicKey.toBase58()), wallet.publicKey, [], new anchor.web3.PublicKey("11111111111111111111111111111111")));
    const txSignature = await sendAndConfirmTransaction(connection2, transaction, [wallet]); // Ensure you include your signer

    console.log('Transaction signature:', txSignature);
    // const afterOriginalBalance = await connection.getBalance(wallet.publicKey);


    return {
        txHash: txSignature
    }
}


module.exports = {
    getSolanaBalance,
    generateWallet,
    withdrawAll
};
