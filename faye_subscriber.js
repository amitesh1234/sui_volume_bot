const Faye = require('faye');
const { runVolumeBot } = require('./solana_bundling/solana_bundle');

let client = new Faye.Client('http://localhost:8675/');

client.subscribe('/RUN_BOT', (data) => {
    runVolumeBot(data?.token, data?.minAmount, data?.maxAmount, data?.transactionsPerMinute, data?.secretKey, data?.targetVolumeInSol, data?.launchId);
});