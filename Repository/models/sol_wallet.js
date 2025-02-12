"use strict";
const { Sequelize } = require("sequelize");
module.exports = function (sequelize, DataTypes) {
    const sol_wallet = sequelize.define("sol_wallet", {
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
        publickey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        secretkey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        balance: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: "sol_wallet", // Make sure this matches your table name
        timestamps: true // Set to true if you want timestamps like createdAt and updatedAt columns
    });
   
    sol_wallet.beforeCreate((instance) => {
        // Set the createdAt field to the current date/time
        instance.createdAt = new Date();
    });
    sol_wallet.beforeUpdate((instance) => {
        // Set the updatedAt field to the current date/time
        instance.updatedAt = new Date();
    });

    sol_wallet.sync().then(() => {
        console.log("sol_wallet Model synced");
    });
    return sol_wallet;
};
