const { AccountInfo, AddressLookupTableAccount, PublicKey } = require('@solana/web3.js');
const { connection } = require('./constants');

/**
 * This class solves 2 problems:
 * 1. Cache and geyser subscribe to lookup tables for fast retrieval.
 * 2. Compute the ideal lookup tables for a set of addresses.
 * 
 * The second problem/solution is needed because jito bundles cannot include a txn that uses a lookup table
 * that has been modified in the same bundle. So this class caches all lookups and then computes the ideal lookup tables
 * for a set of addresses used by the arb txn so that the arb txn size is reduced below the maximum.
 */
class LookupTableProvider {
  constructor() {
    this.lookupTables = new Map();
    this.lookupTablesForAddress = new Map();
    this.addressesForLookupTable = new Map();
  }

  updateCache(lutAddress, lutAccount) {
    this.lookupTables.set(lutAddress.toBase58(), lutAccount);

    this.addressesForLookupTable.set(lutAddress.toBase58(), new Set());

    for (const address of lutAccount.state.addresses) {
      const addressStr = address.toBase58();
      this.addressesForLookupTable.get(lutAddress.toBase58()).add(addressStr);
      if (!this.lookupTablesForAddress.has(addressStr)) {
        this.lookupTablesForAddress.set(addressStr, new Set());
      }
      this.lookupTablesForAddress.get(addressStr).add(lutAddress.toBase58());
    }
  }

  processLookupTableUpdate(lutAddress, data) {
    const lutAccount = new AddressLookupTableAccount({
      key: lutAddress,
      state: AddressLookupTableAccount.deserialize(data.data),
    });

    this.updateCache(lutAddress, lutAccount);
    return;
  }

  async getLookupTable(lutAddress) {
    const lutAddressStr = lutAddress.toBase58();
    if (this.lookupTables.has(lutAddressStr)) {
      return this.lookupTables.get(lutAddressStr);
    }

    const lut = await connection.getAddressLookupTable(lutAddress);
    if (lut.value === null) {
      return null;
    }

    this.updateCache(lutAddress, lut.value);

    return lut.value;
  }

  computeIdealLookupTablesForAddresses(addresses) {
    const MIN_ADDRESSES_TO_INCLUDE_TABLE = 1;
    const MAX_TABLE_COUNT = 30;

    const addressSet = new Set();
    const tableIntersections = new Map();
    const selectedTables = [];
    const remainingAddresses = new Set();
    let numAddressesTakenCareOf = 0;

    for (const address of addresses) {
      const addressStr = address.toBase58();

      if (addressSet.has(addressStr)) continue;
      addressSet.add(addressStr);

      const tablesForAddress = this.lookupTablesForAddress.get(addressStr) || new Set();

      if (tablesForAddress.size === 0) continue;

      remainingAddresses.add(addressStr);

      for (const table of tablesForAddress) {
        const intersectionCount = tableIntersections.get(table) || 0;
        tableIntersections.set(table, intersectionCount + 1);
      }
    }

    const sortedIntersectionArray = Array.from(tableIntersections.entries()).sort((a, b) => b[1] - a[1]);

    for (const [lutKey, intersectionSize] of sortedIntersectionArray) {
      if (intersectionSize < MIN_ADDRESSES_TO_INCLUDE_TABLE) break;
      if (selectedTables.length >= MAX_TABLE_COUNT) break;
      if (remainingAddresses.size <= 1) break;

      const lutAddresses = this.addressesForLookupTable.get(lutKey);

      const addressMatches = new Set([...remainingAddresses].filter((x) => lutAddresses.has(x)));

      if (addressMatches.size >= MIN_ADDRESSES_TO_INCLUDE_TABLE) {
        selectedTables.push(this.lookupTables.get(lutKey));
        for (const address of addressMatches) {
          remainingAddresses.delete(address);
          numAddressesTakenCareOf++;
        }
      }
    }

    return selectedTables;
  }
}

const lookupTableProvider = new LookupTableProvider();

lookupTableProvider.getLookupTable(
  // Custom lookup tables
  new PublicKey('Gr8rXuDwE2Vd2F5tifkPyMaUR67636YgrZEjkJf9RR9V')
);

module.exports = { lookupTableProvider };
