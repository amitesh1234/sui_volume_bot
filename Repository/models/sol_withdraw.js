"use strict";
const { Sequelize } = require("sequelize");
module.exports = function (sequelize, DataTypes) {
    const sol_withdraw = sequelize.define("sol_withdraw", {
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
        topublickey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        frompublickey: {
            type: DataTypes.STRING,
            allowNull: true
        },
        txhash: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: "sol_withdraw", // Make sure this matches your table name
        timestamps: true // Set to true if you want timestamps like createdAt and updatedAt columns
    });
   
    sol_withdraw.beforeCreate((instance) => {
        // Set the createdAt field to the current date/time
        instance.createdAt = new Date();
    });
    sol_withdraw.beforeUpdate((instance) => {
        // Set the updatedAt field to the current date/time
        instance.updatedAt = new Date();
    });

    sol_withdraw.sync().then(() => {
        console.log("sol_withdraw Model synced");
    });
    return sol_withdraw;
};
