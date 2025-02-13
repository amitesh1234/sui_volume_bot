const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

// Initialize a connection to the Solana blockchain
const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

// Function to check the balance of a Solana wallet
const getSolanaBalance = async (publicKey) => {
    try {
        const walletAddress = new PublicKey(publicKey);
        const balance = await connection.getBalance(walletAddress);
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


module.exports = {
    getSolanaBalance,
    generateWallet
};
