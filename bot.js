require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply('Welcome to the Ultimate Solana bot, Use this bot to Increase your solana teoken volume as high as 1 USD in a matter of minutes. \n \n Please enter the token address.'));
const asyncFunction = async (input) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(`Processed: ${input.toUpperCase()}`);
        }, 3000); // Simulating a delay of 3 seconds
    });
};

// Handle text messages
bot.on('text', async (ctx) => {
    try {
        const userText = ctx.message.text;

        // Show "typing..." indicator
        await ctx.sendChatAction('typing');

        // Call the async function
        const response = await asyncFunction(userText);

        // Send response after processing
        await ctx.reply(response);
    } catch (error) {
        console.error('Error:', error);
        await ctx.reply('Oops! Something went wrong.');
    }
});
bot.launch();
console.log('Bot is running...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));