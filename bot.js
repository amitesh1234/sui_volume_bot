require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const BigNumber = require('bignumber.js');
const { transactionsPerMinute, validateSolAmountRange, minSolBalance, averageFee, averageJitofee } = require('./constants')
const { createSBD, createData, getSingleData, updateData } = require('./Repository/DBE');
require('./Repository/models');
const { getSolanaBalance, generateWallet } = require("./solana_bundling/getbalanace");

const Faye = require('faye');
const { LAMPORTS_PER_SOL, PublicKey } = require('@solana/web3.js');
let client = new Faye.Client('http://localhost:8675/');

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
        return null;
    }
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Temporary in-memory storage
const userSessions = {};


async function getSOLPrice() {
    try {
        const response = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT");
        const data = await response.json();
        console.log("SOL Price:", data.price);
        return data.price;
    } catch (error) {
        console.error("Error fetching SOL price:", error);
    }
}

// Function to validate Solana token address
const isValidSolanaAddress = (address) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);


// Function to validate amount (BigNumber)
const isValidAmount = (amount) => {
    try {
        const bigAmount = new BigNumber(amount);
        return bigAmount.isPositive() && bigAmount.isFinite();
    } catch {
        return false;
    }
};

// id, publickey, privatekey, isactive, createdat
// Step 1: Welcome Message
bot.start((ctx) => {
    const userId = ctx.from.id;
    userSessions[userId] = {}; // Initialize user session

    ctx.reply(
        '👋 *Welcome to the Ultimate Solana Bot!* \n\n' +
        '💎 Use this bot to increase your Solana token volume efficiently.\n\n' +
        '🔹 *Please enter the token address to proceed.*',
        { parse_mode: 'Markdown' }
    );
});

// Step 2: Handle Token Address Input & Ask for Volume
bot.on('text', async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userText = ctx.message.text.trim();
        if (userText === "\\start")
            return ctx.reply('❌ To Start the bot please enter /start.');


        if (!userSessions[userId]?.tokenAddress) {
            if (!isValidSolanaAddress(userText))
                return ctx.reply('❌ Invalid Solana token address! Please enter a valid 32-44 character Solana address.');

            const tokenInfo = await getTokenInfo(userText)
            if (!tokenInfo)
                return ctx.reply("❌ Can't find token pair on exchange.");

            userSessions[userId].tokenAddress = userText;

            return ctx.reply(
                '✅ Token address received!\n\n' +
                '📨 *Input target Volume amount ($):*',
                { parse_mode: 'Markdown' }
            );
        }

        if (!userSessions[userId]?.targetVolume) {
            if (!isValidAmount(userText))
                return ctx.reply('❌ Invalid amount! Please enter a positive number for the target volume.');


            userSessions[userId].targetVolume = userText;
            const wallet = await getSingleData({ userid: userId.toString() }, "sol_wallet");

            if (!wallet?.publickey) {
                const { publicKey, secretKey } = await generateWallet();

                const data = {
                    userid: userId,
                    publickey: publicKey,
                    secretkey: secretKey,
                    balance: "0"
                }

                await createData(data, "sol_wallet");
                const solPrice = await getSOLPrice();

                userSessions[userId].depositWallet = publicKey;
                userSessions[userId].solBalance = "0";
                userSessions[userId].targetVolumeSol = Math.ceil((userText / solPrice)*100)/100;
                return showMainTemplate(ctx, userId);
            }

            const solPrice = await getSOLPrice();
            userSessions[userId].targetVolumeSol = Math.ceil((userText / solPrice)*100)/100;
            userSessions[userId].depositWallet = wallet.publickey;
            userSessions[userId].solBalance = wallet.balance;

            return showMainTemplate(ctx, userId);
        }

        // If user is waiting for custom delay input
        // if (userSessions[userId]?.waitingForCustomDelay) {
        //     const customDelay = parseInt(userText, 10);

        //     if (isNaN(customDelay) || customDelay <= 0)
        //         return ctx.reply('❌ Invalid input! Please enter a positive number for transactions per minute.');

        //     // Store the custom delay and update the user session
        //     userSessions[userId].delayMode = "Custom";
        //     userSessions[userId].transactionsPerMinute = customDelay;
        //     userSessions[userId].waitingForCustomDelay = false; // Reset state

        //     // Show the updated main template
        //     return showMainTemplate(ctx, userId);
        // }

        // If user is waiting for custom delay input
        if (userSessions[userId]?.waitingForCustomSolAmount) {

            const checkSolAmount = validateSolAmountRange(userText);
            // const solAmount = parseFloat(userText); // Parse as float

            if (!checkSolAmount?.valid)
                return ctx.reply(checkSolAmount?.message || '❌ Invalid input! Please enter a valid SOL amount (minimum 0.001).');


            // Store the custom SOL amount and update the user session
            userSessions[userId].swapSolAmount = userText; // Ensure 3 decimal places
            userSessions[userId].waitingForCustomSolAmount = false; // Reset state

            // Show the updated main template
            return showMainTemplate(ctx, userId);
        }


    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('⚠️ Oops! Something went wrong. Please try again.');
    }
});

// Function to show the main template with buttons in new order
function showMainTemplate(ctx, userId) {

    const LaunchButton = [Markup.button.callback('🚀 Launch', 'LAUNCH_BOT')]
    const stopButton = [Markup.button.callback('🛑 Stop', 'STOP_BOT')];

    let buttons = [
        userSessions[userId]?.status === "Launched" ? stopButton : LaunchButton,
        [Markup.button.callback(`▶️ Transactions per minute (${userSessions[userId]?.transactionsPerMinute || 30})`, 'SHOW_DELAY_OPTIONS'), Markup.button.callback(`✅ Buy with min-max ${userSessions[userId]?.swapSolAmount || '3-4'} SOL`, 'BUY_SOL')],
        // [Markup.button.callback('💵 Withdraw', 'WITHDRAW'), Markup.button.callback('🔄 Refresh', 'REFRESH')],
        [Markup.button.callback('📖 Guide', 'GUIDE'), Markup.button.callback('📖 Refresh', 'REFRESH_BOT_DETAILS')]
    ];

    ctx.reply(
        `\uD83D\uDD39 *Welcome to Impact Bot (Alpha)* \uD83D\uDD39\n\n` +
        `Impact Bot (Alpha): A high-speed, anti-MEV volume bot designed specifically for Solana.\n\n` +
        `✅ *Token Info:* \n` +
        `🔹 Token Address: \`${userSessions[userId]?.tokenAddress}\`\n` +
        `💰 Target Volume Amount: *$${userSessions[userId]?.targetVolume}*\n\n` +
        `💰 Estimated Target Volume Sol AMount: *${userSessions[userId]?.targetVolumeSol || '0'} SOL*\n\n` +
        `⚙️ ${userSessions[userId]?.delayMode || "Fast"} Mode: ${userSessions[userId]?.transactionsPerMinute || "30"} transactions per min\n` +
        `🔄 Sol swapped per TX: ${userSessions[userId]?.swapSolAmount || "3-4"} SOL\n\n` +
        // `⏳ Bot worked: 0 min\n` +
        `⏳ Bot current Batch Number: ${userSessions[userId]?.currentBatch || 0} \n` +
        `📊 Bot made: ${userSessions[userId]?.achievedVolume || 0} Sol Volume achieved. , ${userSessions[userId]?.transactionDone || 0} Txns\n\n` +
        `${userSessions[userId]?.depositWallet ? '💰 *Your Deposit Wallet:*' : ''}\n` +
        `\`${userSessions[userId]?.depositWallet || ''}\`\n` +
        `💲 Balance: ${userSessions[userId]?.solBalance || "0"} SOL\n\n` +
        `💲 Minimum Balance Required for bot to run: ${minSolBalance} SOL\n\n` +
        ` ${userSessions[userId]?.status === "Launched" ? "🟢 " + userSessions[userId]?.status : userSessions[userId]?.status || ""}`,
        // `⚠️ The minimum deposit to reach the target volume is 4.1 SOL\n` +
        // `⏳ The estimated time to reach the target volume is 1.5 min`,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        }
    );
}

// Handle showing buy options when Buy SOL is clicked
bot.action('BUY_SOL', (ctx) => {
    ctx.reply(
        `Select the max SOL amount per swap bundle from the options below.\n\n` +
        `More SOL amount will run volume up quicker, with lower SOL amount it takes longer to achieve target volume.\n\n` +
        `⚠️ Note that the bot will never trade more than 80% of the balance in a given bundle.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('1-2 SOL', 'SWAP_SOL_1'), Markup.button.callback('3-4 SOL', 'SWAP_SOL_3')],
            [Markup.button.callback('5-6 SOL', 'SWAP_SOL_5'), Markup.button.callback('Custom SOL', 'ADD_CUSTOM_SOL_SWAP')]
        ])
    );
});

// Handle showing delay options
bot.action('SHOW_DELAY_OPTIONS', (ctx) => {
    ctx.reply(
        `Please select your desired number of buys per minute from the options below.\n\n` +
        `🎈 Regular Mode: ${transactionsPerMinute?.Regular} transactions per min\n\n` +
        `🎈 Fast Mode: ${transactionsPerMinute?.Fast} transactions per min\n\n` +
        `🎈 Turbo Mode: ${transactionsPerMinute?.Turbo} transactions per min\n\n` +
        `More transactions per minute will run volume up quicker, lower tx per minute while last longer, but take longer to achieve target volume.\n`,
        Markup.inlineKeyboard([
            // [Markup.button.callback('🟢 Regular', 'DELAY_Regular'), Markup.button.callback('🔵 Fast', 'DELAY_Fast'), Markup.button.callback('🔴 Turbo', 'DELAY_Turbo'), Markup.button.callback('⚙️ Custom', 'ADD_CUSTOM_DELAY')]
            [Markup.button.callback('🟢 Regular', 'DELAY_Regular'), Markup.button.callback('🔵 Fast', 'DELAY_Fast'), Markup.button.callback('🔴 Turbo', 'DELAY_Turbo')]
        ])
    );
});


// Guide Template
bot.action('GUIDE', (ctx) => {
    ctx.reply(
        `📖 *Help Guide* \n\n` +
        `This bot uses multi wallets for volume increasing.\n` +
        `You have to deposit some SOL to your deposit wallet.\n\n` +
        `When the bot starts working, it takes a 0.1% tax from the deposit wallet.\n\n` +
        `⚙️ *Bot Settings:*\n` +
        `🔹 *Target Volume Amount:* This is the amount of volume the bot needs to achieve. The bot stops automatically when it reaches the target.\n` +
        `🔹 *TRX Rating:* This is the transaction count per minute.\n\n` +
        `You can withdraw SOL from your deposit wallet at any time.\n\n` +
        `For more features, please contact: @OGSolanaBot\n\n` +
        `Thank you.`,
        Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Back to Main', 'BACK_TO_MAIN')]
        ])
    );
});

// Handle going back to the main template
bot.action('BACK_TO_MAIN', (ctx) => {
    const userId = ctx.from.id;
    showMainTemplate(ctx, userId);
});

// Handle delay time selection
bot.action(/^DELAY_/, async (ctx) => {
    const userId = ctx.from.id;
    const mode = ctx?.update?.callback_query?.data.split('_')[1];

    if (mode === "DELAY_CUSTOM") {
        ctx.reply("📨 Input transactions per min.")
    }
    const capitalizedMode = mode.charAt(0).toUpperCase() + mode.slice(1);

    if (!userSessions[userId]) userSessions[userId] = {}; // Ensure session exists

    userSessions[userId].delayMode = capitalizedMode;
    userSessions[userId].transactionsPerMinute = transactionsPerMinute[capitalizedMode];

    showMainTemplate(ctx, userId);

});

// bot.action('ADD_CUSTOM_DELAY', async (ctx) => {
//     const userId = ctx.from.id;
//     if (!userSessions[userId]) return; // Ensure session exists
//     userSessions[userId].waitingForCustomDelay = true;

//     ctx.reply('⏳ Please enter your custom transactions per minute (e.g., 50):');

// });

// Handle delay time selection
bot.action(/^SWAP_SOL_/, async (ctx) => {
    const userId = ctx.from.id;
    const solAmount = ctx?.update?.callback_query?.data.split('_')[2];

    if (!userSessions[userId]) userSessions[userId] = {}; // Ensure session exists

    userSessions[userId].swapSolAmount = solAmount;
    showMainTemplate(ctx, userId);
});

bot.action('ADD_CUSTOM_SOL_SWAP', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return; // Ensure session exists
    userSessions[userId].waitingForCustomSolAmount = true;

    ctx.reply('⏳ Please enter the amount range of SOL to use in buying.(e.g., 3-7):');

});

bot.action('LAUNCH_BOT', async (ctx) => {
    const userId = ctx.from.id;
    const data = userSessions[userId];
    console.log("Data: ", data);
    if (!data || !data?.tokenAddress || !data?.targetVolume)
        return ctx.reply("⏳ Can't launch the bot.");

    const collectingData = {
        userid: userId,
        fullname: ctx.from.first_name || "" + " " + ctx.from.last_name || "",
        username: ctx.from.username || "",
        tokenaddress: data?.tokenAddress,
        targetvolume: data?.targetVolume,
        transactions: data?.transactionsPerMinute || '30', //default
        amount: data?.swapSolAmount || '3-4', //default
        targetvolumeinsol: data?.targetVolumeSol,
        status: 'Launched'
    }
    

    const response = await createSBD(collectingData);
    if (!response?.id) return ctx.reply("⏳ Can't launch the bot.");

    // Reset user session for a fresh start
    // minAMount*LAMPORTS_PER_SOL
    // userSessions[userId] = {};
    const ssa = validateSolAmountRange(collectingData?.amount)
    if (!ssa?.valid) return ctx.reply("⏳ Can't launch the bot.");

    const wallet = await getSingleData({ userid: userId.toString() }, "sol_wallet")
    if (!wallet?.secretkey) return ctx.reply("⏳ Can't launch the bot.");
    const recentUserSolBalance = await getSolanaBalance(wallet?.publickey);
    if(recentUserSolBalance < Number(ssa?.max)) {
        return ctx.reply(`⏳ Balance less than max transaction size set by you!`);

    }
    // if (recentUserSolBalance < minSolBalance) {
    //     return ctx.reply(`⏳ Balance less than ${minSolBalance} SOL, Please topup the wallet to start the bot!`);
    // }
    const expectedNumberofTransactions = Math.ceil(collectingData?.targetvolumeinsol / ((Number(ssa?.min) + Number(ssa?.max)) / 2));
    const reqBalance = (averageFee * expectedNumberofTransactions) + (averageJitofee * Math.floor(expectedNumberofTransactions / 2));
    console.log(expectedNumberofTransactions, reqBalance, recentUserSolBalance);
    // if (recentUserSolBalance < reqBalance) {
    //     return ctx.reply(`⏳ Insufficient Balance to move with the bot, based on the conditions give, min balance should be approximately ${reqBalance}!`);
    // }
    const publishData = {
        targetVolume: collectingData?.targetvolume,
        targetVolumeInSol: collectingData?.targetvolumeinsol * LAMPORTS_PER_SOL,
        minAmount: Number(ssa?.min) * LAMPORTS_PER_SOL,
        maxAmount: Number(ssa?.max) * LAMPORTS_PER_SOL,
        transactionsPerMinute: collectingData?.transactions,
        secretKey: wallet.secretkey,
        token: collectingData?.tokenaddress,
        launchId: response?.id
    }

    console.log("publishData: ", publishData);


    client.publish('/RUN_BOT', publishData);

    userSessions[userId].status = 'Launched';
    userSessions[userId].sessionId = response?.id;
    // clearing session 
    // userSessions[userId] = {};
    // ctx.reply(
    //     `\uD83D\uDD39 *Impact Bot (Alpha): Launched successfully* \uD83D\uDD39\n\n` +
    //     `Impact Bot (Alpha): A high-speed, anti-MEV volume bot designed specifically for Solana.\n\n` +
    //     `🔹 Launch id: \`${response?.id}\`\n` +
    //     `💰 *Keep this id for future status.*\n\n` +
    //     `🔄 For Start new session, Enter /start.`
    // )
    showMainTemplate(ctx, userId)
    //data
    //insert 
});


bot.action('REFRESH_BOT_DETAILS', async (ctx) => {
    const userId = ctx.from.id;

    const data = userSessions[userId];

    if (data?.sessionId && data?.status === "Launched") {
        const sessionData = await getSingleData({ id: data?.sessionId }, "sol_bot_details");
        console.log(sessionData);
        if (!sessionData) return showMainTemplate(ctx, userId)
        userSessions[userId].tokenAddress = sessionData?.tokenaddress;
        userSessions[userId].targetVolume = sessionData?.targetvolume;
        userSessions[userId].targetVolumeSol = sessionData?.targetvolumeinsol;
        userSessions[userId].transactionsPerMinute = sessionData?.transactions;
        userSessions[userId].swapSolAmount = sessionData?.amount;
        userSessions[userId].transactionDone = sessionData?.totaltransactioninitiated;
        userSessions[userId].currentBatch = sessionData?.currentbatchnumber;
        userSessions[userId].achievedVolume = sessionData?.achievedvolume;
    }
    let dW = data?.depositWallet;
    if (!data?.depositWallet) {
        const walletInfo = await getSingleData({ userid: userId.toString() }, "sol_wallet")
        if (!walletInfo?.publickey) return ctx.reply("⏳ Can't find wallet info, please try again later.")
        dW = walletInfo?.publickey;
    }

    const balance = await getSolanaBalance(dW);
    if (!balance) return ctx.reply("⏳ Some issue occurred, please try again later.")

    updateData({ balance: balance }, { userid: userId }, "sol_wallet")

    userSessions[userId].solBalance = balance;
    showMainTemplate(ctx, userId);
});

bot.action('STOP_BOT', async (ctx) => {
    const userId = ctx.from.id;

    const data = userSessions[userId];
    if (!data?.sessionId || data?.status !== "Launched")
        return ctx.reply("Sorry no data found.");

    const response = await updateData({ status: "ForceStop" }, { id: data?.sessionId }, "sol_bot_details")
    if (response?.length && response[0] === 0) return ctx.reply("Sorry failed to stop bot");
    // clearing session.
    userSessions[userId] = {}
    return ctx.reply(`Your bot has been stopped.\n\n Want to start new session press /start.`)


});

// Start the bot
bot.launch();
console.log('🚀 Bot is running...');

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
