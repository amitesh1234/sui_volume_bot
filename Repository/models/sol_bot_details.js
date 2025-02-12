"use strict";
const { Sequelize } = require("sequelize");
module.exports = function (sequelize, DataTypes) {
  const sol_bot_details = sequelize.define("sol_bot_details", {
    id: {
      type: Sequelize.UUID,
      primaryKey: true,
      defaultValue: Sequelize.literal("uuid_generate_v4()"),
      allowNull: false
    },
    userid: {
      type: DataTypes.STRING,
      allowNull: true
    },
    fullname: {
      type: DataTypes.STRING,
      allowNull: true
    },
    username: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tokenaddress: {
      type: DataTypes.STRING,
      allowNull: true
    },
    targetvolume: {
      type: DataTypes.STRING,
      allowNull: true
    },
    targetvolumeinsol: {
      type: DataTypes.STRING,
      allowNull: true
    },
    transactions: {
      type: DataTypes.STRING,
      allowNull: true
    },
    amount: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true
    },
    achievedvolume: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "0"
    },
    currentbatchnumber: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "0"
    },
    totaltransactioninitiated: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "0"
    },
  }, {
    tableName: "sol_bot_details", // Make sure this matches your table name
    timestamps: true // Set to true if you want timestamps like createdAt and updatedAt columns
  });
  // user.associate = function (models) {
  //   user.hasOne(models.kycrequests, {
  //     foreignKey: "userid",
  //     constraints: false,
  //     as: "kycdetails"
  //   });

  // };
  sol_bot_details.beforeCreate((instance) => {
    // Set the createdAt field to the current date/time
    instance.createdAt = new Date();
  });
  sol_bot_details.beforeUpdate((instance) => {
    // Set the updatedAt field to the current date/time
    instance.updatedAt = new Date();
  });

  sol_bot_details.sync().then(() => {
    console.log("sol_bot_details Model synced");
  });
  return sol_bot_details;
};
