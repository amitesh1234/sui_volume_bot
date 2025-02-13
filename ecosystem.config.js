module.exports = {
    apps: [
      {
        name: "telegram-bot",
        script: "bot.js",
        watch: true,
        env: {
          NODE_ENV: "production"
        }
      },
      {
        name: "faye-subscriber",
        script: "faye_subscriber.js",
        watch: true,
        env: {
          NODE_ENV: "production"
        }
      },
      {
        name: "faye-server",
        script: "faye_server.js",
        watch: true,
        env: {
          NODE_ENV: "production"
        }
      }
    ]
  };
  