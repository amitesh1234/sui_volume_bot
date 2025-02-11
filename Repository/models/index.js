"use strict";
const Sequelize = require("sequelize");
const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");
const basename = path.basename(__filename);
const db = {};
dotenv.config({ path: `.env` });

db.Sequelize = Sequelize;

async function initializeDatabase() {
  console.log("Loading Database Config");
  const sequelize = new Sequelize(
    process.env.PG_DATABASE,
    process.env.PG_USER,
    process.env.PG_PASSWORD,
    {
      host: process.env.PG_HOST,
      dialect: "postgres",
      port: process.env.PG_PORT,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      },
      logging: false, // Disable logging for cleaner output
    }
  );

  sequelize
    .authenticate()
    .then(() => {
      console.log("Connection has been established with the database");
    })
    .catch((err) => {
      console.log("Unable to connect to the database:", err);
    });

  fs.readdirSync(__dirname)
    .filter(
      (file) =>
        file.indexOf(".") !== 0 &&
        file !== basename &&
        file.slice(-3) === ".js"
    )
    .forEach((file) => {
      const model = require(path.join(__dirname, file))(sequelize, Sequelize);
      db[model?.name] = model;
    });

  Object.keys(db).forEach((modelName) => {
    if (db[modelName]?.associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
}

initializeDatabase().catch(err => {
  console.error("Failed to initialize database:", err);
});

module.exports = db;
