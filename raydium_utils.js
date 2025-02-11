const {
    Liquidity,
    LIQUIDITY_STATE_LAYOUT_V4,
    Market,
    MARKET_STATE_LAYOUT_V3,
    Percent,
    SPL_MINT_LAYOUT,
    Token,
    TokenAmount
  } = require("@raydium-io/raydium-sdk");
  const { 
    getAssociatedTokenAddressSync, 
    NATIVE_MINT, 
    TOKEN_PROGRAM_ID 
  } = require("@solana/spl-token");
  const { connection } = require('./constants.js');
  const { PublicKey } = require("@solana/web3.js");


export const getLiquidityV4PoolKeys = async (pool) => {
    const poolAccount = await connection.getAccountInfo(pool, "confirmed");
    if (!poolAccount) return null;
    const poolInfo = LIQUIDITY_STATE_LAYOUT_V4.decode(poolAccount.data);
  
    if (poolInfo.baseMint.toBase58() != Token.WSOL.mint.toBase58() && poolInfo.quoteMint.toBase58() != Token.WSOL.mint.toBase58()) {
      return null;
    }
  
    const marketAccount = await connection.getAccountInfo(poolInfo.marketId, "confirmed");
    if (!marketAccount) return null;
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
  
    const lpMintAccount = await connection.getAccountInfo(poolInfo.lpMint, "confirmed");
    if (!lpMintAccount) return null;
    const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);
  
    const poolKeys = {
      id: pool,
      baseMint: poolInfo.baseMint,
      quoteMint: poolInfo.quoteMint,
      lpMint: poolInfo.lpMint,
      baseDecimals: poolInfo.baseDecimal,
      quoteDecimals: poolInfo.quoteDecimal,
      lpDecimals: lpMintInfo.decimals,
      version: 4,
      programId: poolAccount.owner,
      authority: Liquidity.getAssociatedAuthority({ programId: poolAccount.owner }).publicKey,
      openOrders: poolInfo.openOrders,
      targetOrders: poolInfo.openOrders,
      baseVault: poolInfo.baseVault,
      quoteVault: poolInfo.quoteVault,
      withdrawQueue: poolInfo.withdrawQueue,
      lpVault: poolInfo.lpVault,
      marketVersion: 3,
      marketProgramId: poolInfo.marketProgramId,
      marketId: poolInfo.marketId,
      marketAuthority: Market.getAssociatedAuthority({ programId: poolInfo.marketProgramId, marketId: poolInfo.marketId }).publicKey,
      marketBaseVault: marketInfo.baseVault,
      marketQuoteVault: marketInfo.quoteVault,
      marketBids: marketInfo.bids,
      marketAsks: marketInfo.asks,
      marketEventQueue: marketInfo.eventQueue,
      lookupTableAccount: PublicKey.default,
    };
  
    return poolKeys;
  };