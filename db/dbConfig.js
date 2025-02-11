require("dotenv").config();

module.exports = {
    PGUSER: process.env.ENV === "local" ? "postgres" : "volumebot",
    PGHOST:  "localhost",
    PGPASSWORD:  process.env.ENV === "local" ? "1234" : "volumebot",
    PGDATABASE:  process.env.ENV === "local" ? "solanavolumebot" : "postgres",
    PGPORT: 5432,
  };