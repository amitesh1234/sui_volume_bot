const { VersionedTransaction, TransactionMessage } = require("@solana/web3.js");
const bs58 = require("bs58");
const { lookupTableProvider } = require("../lookupTableProvider");

const makeVersionedTransactionAndSign2 = async (
    instructions, 
    payer, 
    blockhash,
    signer,
    lookupTableAccount
) => {
    const addresses = [];
    instructions.forEach(ixn => ixn.keys.forEach(key => addresses.push(key.pubkey)));

    // const lookupTables = lookupTableProvider.computeIdealLookupTablesForAddresses(addresses);
    const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockhash,
        instructions: instructions,
    }).compileToV0Message([lookupTableAccount]);
    
    try {
    const tx = new VersionedTransaction(messageV0);
    tx.sign(signer);
    const serializedTransaction = tx.serialize();
    const base58EncodedTransaction = bs58.default.encode(serializedTransaction);
    return base58EncodedTransaction;
} catch (error) {
    console.error('Error signing the transaction:', error);
    throw error;
}
};

module.exports = {
    makeVersionedTransactionAndSign2
}