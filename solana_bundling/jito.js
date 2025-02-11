const { Connection, PublicKey, Transaction, SystemProgram, ComputeBudgetProgram, Keypair, TransactionInstruction } = require('@solana/web3.js');
const { JitoJsonRpcClient } = require('./jitoRpc.js');
const bs58 = require('bs58');
const fs = require('fs');
require("dotenv").config();
const { connection } = require("../constants.js");
// const { swapConfig } = require("./swapConfig");


// const {connection} = require('./scripts/constants')


async function basicBundle(txs, walletKeypair, otherpayer) {
  // Set up Jito client
  const jitoClient = new JitoJsonRpcClient(swapConfig.blockEngine, "");
  const randomTipAccount = await jitoClient.getRandomTipAccount();
  const jitoTipAccount = new PublicKey(randomTipAccount);
  const jitoTipAmount = swapConfig.jitoTip; // lamports
  // const transferAmount = swapConfig.transferAmount; // lamports

  // Initialize a new transaction
  const transaction = new Transaction();

  // Add Jito tip instruction
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: walletKeypair.publicKey,
      toPubkey: jitoTipAccount,
      lamports: jitoTipAmount,
    })
  );

  // Loop through the receivers array and add transfer instructions
  // receivers.forEach(receiver => {
  //   transaction.add(
  //     SystemProgram.transfer({
  //       fromPubkey: walletKeypair.publicKey,
  //       toPubkey: new PublicKey(receiver),
  //       lamports: transferAmount,
  //     })
  //   );
  // });

  // Get recent blockhash and set transaction parameters
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = walletKeypair.publicKey;

  // Sign the transaction
  transaction.sign(walletKeypair);

  // Serialize, encode, and prepare the transaction bundle
  const serializedTransaction = transaction.serialize({ verifySignatures: false });
  const base58EncodedTransaction = bs58.default.encode(serializedTransaction);
  const updatedTxsArray = [base58EncodedTransaction, ...txs];

  try {
    // Send the bundle
    const result = await jitoClient.sendBundle([updatedTxsArray]);
    console.log('Bundle send result:', result);

    const bundleId = result.result;
    console.log('Bundle ID:', bundleId);

    const inflightStatus = await jitoClient.confirmInflightBundle(bundleId, 120000); // 120 seconds timeout
    console.log('Inflight bundle status:', JSON.stringify(inflightStatus, null, 2));
    if (inflightStatus.confirmation_status === "confirmed") {
      console.log(`Bundle successfully confirmed on-chain at slot ${inflightStatus.slot}`);
    }
    else if (inflightStatus.err) {
      console.log('Bundle processing failed:', inflightStatus.err);
    } else {
      console.log('Unexpected inflight bundle status:', inflightStatus);
    }


    // Additional confirmation code here if needed

  } catch (error) {
    console.error('Error sending or confirming bundle:', error);
    if (error.response && error.response.data) {
      console.error('Server response:', error.response.data);
    }
  }
}

async function getJitoTransferIx(walletKeypair) {
  const jitoClient = new JitoJsonRpcClient("https://ny.mainnet.block-engine.jito.wtf/api/v1", "");
  const randomTipAccount = await jitoClient.getRandomTipAccount();
  const jitoTipAccount = new PublicKey(randomTipAccount);
  const jitoTipAmount = 700000; // lamports
  // const transferAmount = swapConfig.transferAmount; // lamports

  // Initialize a new transaction
  return SystemProgram.transfer({
    fromPubkey: walletKeypair.publicKey,
    toPubkey: jitoTipAccount,
    lamports: jitoTipAmount,
  });

}

async function basicBundleJito(txs) {

  try {
    const jitoClient = new JitoJsonRpcClient("https://ny.mainnet.block-engine.jito.wtf/api/v1", "");

    const result = await jitoClient.sendBundle([txs]);
    console.log('Bundle send result:', result);

    // const inflightStatus = await jitoClient.confirmInflightBundle(bundleId, 120000); // 120 seconds timeout
    // console.log('Inflight bundle status:', JSON.stringify(inflightStatus, null, 2));
    // if (inflightStatus.confirmation_status === "confirmed") {
    //   console.log(`Bundle successfully confirmed on-chain at slot ${inflightStatus.slot}`);
    // }
    // else if (inflightStatus.err) {
    //   console.log('Bundle processing failed:', inflightStatus.err);
    // } else {
    //   console.log('Unexpected inflight bundle status:', inflightStatus);
    // }

  } catch (error) {
    console.error('Error sending or confirming bundle:', error);
    if (error.response && error.response.data) {
      console.error('Server response:', error.response.data);
    }
  }
}

// basicTransaction().catch(console.error);
module.exports = { basicBundle, basicBundleJito, getJitoTransferIx }
// basicBundle()