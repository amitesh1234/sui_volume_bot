require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const BigNumber = require('bignumber.js');
const { transactionsPerMinute, getDelayMs } = require('./constants')

const bot = new Telegraf(process.env.BOT_TOKEN);

// Temporary in-memory storage
const userSessions = {};

// Function to validate Solana token address
const isValidSolanaAddress = (address) => {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
};

// Function to validate amount (BigNumber)
const isValidAmount = (amount) => {
    try {
        const bigAmount = new BigNumber(amount);
        return bigAmount.isPositive() && bigAmount.isFinite();
    } catch {
        return false;
    }
};

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

        if (!userSessions[userId]?.tokenAddress) {
            if (!isValidSolanaAddress(userText)) {
                return ctx.reply('❌ Invalid Solana token address! Please enter a valid 32-44 character Solana address.');
            }

            userSessions[userId].tokenAddress = userText;

            return ctx.reply(
                '✅ Token address received!\n\n' +
                '📨 *Input extra target Volume amount ($):*',
                { parse_mode: 'Markdown' }
            );
        }

        if (!userSessions[userId]?.targetVolume) {
            if (!isValidAmount(userText)) {
                return ctx.reply('❌ Invalid amount! Please enter a positive number for the target volume.');
            }

            userSessions[userId].targetVolume = userText;
            return showMainTemplate(ctx, userId, false);
        }

        // If user is waiting for custom delay input
        if (userSessions[userId]?.waitingForCustomDelay) {
            console.log("delay")
            const customDelay = parseInt(userText, 10);

            if (isNaN(customDelay) || customDelay <= 0) {
                return ctx.reply('❌ Invalid input! Please enter a positive number for transactions per minute.');
            }

            // Store the custom delay and update the user session
            userSessions[userId].delayMode = "Custom Mode";
            userSessions[userId].transactionsPerMinute = customDelay;
            userSessions[userId].waitingForCustomDelay = false; // Reset state

            // Show the updated main template
            return showMainTemplate(ctx, userId, true);
        }

        // If user is waiting for custom delay input
        if (userSessions[userId]?.waitingForCustomSolAmount) {
            console.log("swap")
            const solAmount = parseInt(userText, 10);

            if (isNaN(solAmount) || solAmount <= 0) {
                return ctx.reply('❌ Invalid input! Please enter a positive number for transactions per minute.');
            }

            // Store the custom delay and update the user session
            userSessions[userId].swapSolAmount = solAmount;
            userSessions[userId].waitingForCustomSolAmount = false; // Reset state

            // Show the updated main template
            return showMainTemplate(ctx, userId, true);
        }

    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('⚠️ Oops! Something went wrong. Please try again.');
    }
});

// Function to show the main template with buttons in new order
function showMainTemplate(ctx, userId, showDelayOptions) {
    let buttons = [
        [Markup.button.callback(`▶️ Delay Time (${getDelayMs(userSessions[userId]?.transactionsPerMinute || 30)})`, 'SHOW_DELAY_OPTIONS'), Markup.button.callback(`✅ Buy with ${userSessions[userId]?.swap || '3'} SOL`, 'BUY_SOL')],
        [Markup.button.callback('💵 Withdraw', 'WITHDRAW'), Markup.button.callback('🔄 Refresh', 'REFRESH')],
        [Markup.button.callback('📖 Guide', 'GUIDE'), Markup.button.callback('🔗 Referral', 'REFERRAL')]
    ];

    ctx.reply(
        `\uD83D\uDD39 *Welcome to Impact Bot (Alpha)* \uD83D\uDD39\n\n` +
        `Impact Bot (Alpha): A high-speed, anti-MEV volume bot designed specifically for Solana.\n\n` +
        `✅ *Token Info:* \n` +
        `🔹 Token Address: \`${userSessions[userId].tokenAddress}\`\n` +
        `💰 Target Volume Amount: *$${userSessions[userId].targetVolume}*\n\n` +
        `⚙️ ${userSessions[userId]?.delayMode || "Fast"} Mode: ${userSessions[userId]?.transactionsPerMinute || "30"} transactions per min\n` +
        `🔄 Sol swapped per TX: ${userSessions[userId]?.swapSolAmount || "3"}  SOL\n\n` +
        `⏳ Bot worked: 0 min\n` +
        `📊 Bot made: 0 Makers, 0 Txns\n\n` +
        `💰 *Your Deposit Wallet:*\n` +
        `\`JzC5jGH64AvFW9E5MPyLczP8UWPuea7Hw9gYasbZ\`\n` +
        `💲 Balance: 0 SOL\n\n` +
        `⚠️ The minimum deposit to reach the target volume is 4.1 SOL\n` +
        `⏳ The estimated time to reach the target volume is 1.5 min`,
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
            [Markup.button.callback('1 SOL', 'SWAP_SOL_1'), Markup.button.callback('3 SOL', 'SWAP_SOL_3')],
            [Markup.button.callback('5 SOL', 'SWAP_SOL_5'), Markup.button.callback('Custom SOL', 'ADD_CUSTOM_SOL_SWAP')]
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
            [Markup.button.callback('🟢 Regular', 'DELAY_Regular'), Markup.button.callback('🔵 Fast', 'DELAY_Fast'), Markup.button.callback('🔴 Turbo', 'DELAY_Turbo'), Markup.button.callback('⚙️ Custom', 'ADD_CUSTOM_DELAY')]
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
    showMainTemplate(ctx, userId, false);
});

// Handle delay time selection
bot.action(/^DELAY_/, async (ctx) => {
    const userId = ctx.from.id;
    const mode = ctx?.update?.callback_query?.data.split('_')[1];

    if (mode === "DELAY_CUSTOM") {
        ctx.reply("📨 Input transactions per min.")
    }
    const capitalizedMode = mode.charAt(0).toUpperCase() + mode.slice(1);
    console.log("mode", capitalizedMode);

    if (!userSessions[userId]) userSessions[userId] = {}; // Ensure session exists

    userSessions[userId].delayMode = capitalizedMode;
    userSessions[userId].transactionsPerMinute = transactionsPerMinute[capitalizedMode];

    showMainTemplate(ctx, userId, true);

});

bot.action('ADD_CUSTOM_DELAY', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return; // Ensure session exists
    userSessions[userId].waitingForCustomDelay = true;

    ctx.reply('⏳ Please enter your custom transactions per minute (e.g., 50):');

});

// Handle delay time selection
bot.action(/^SWAP_SOL_/, async (ctx) => {
    const userId = ctx.from.id;
    const solAmount = ctx?.update?.callback_query?.data.split('_')[2];

    // todo 
    // SWAP_CUSTOM_SOL
    if (!userSessions[userId]) userSessions[userId] = {}; // Ensure session exists

    userSessions[userId].swapSolAmount = solAmount;
    showMainTemplate(ctx, userId, true);
});

bot.action('ADD_CUSTOM_SOL_SWAP', async (ctx) => {
    const userId = ctx.from.id;
    if (!userSessions[userId]) return; // Ensure session exists
    userSessions[userId].waitingForCustomSolAmount = true;

    ctx.reply('⏳ Please enter the amount of SOL to use in buying.(e.g., 10):');

});

// Start the bot
bot.launch();
console.log('🚀 Bot is running...');

// Handle graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
