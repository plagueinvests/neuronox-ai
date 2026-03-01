// Netlify Function: check-balance
// Queries Solana RPC for Neuronox token balance server-side to avoid
// browser CORS issues and public RPC rate limits.

const TOKEN_MINT_ADDRESS = '8f7ZpbkLTevSVhFL6XxAwkQCWoMXGiU4P1uqD6pwpump';

const SOLANA_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
];

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

async function queryRpc(rpcUrl, method, params) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RPC error ${data.error.code}: ${data.error.message}`);
    }

    return data;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function getTokenBalance(walletAddress, rpcUrl) {
  // Try standard SPL Token program first
  const data = await queryRpc(rpcUrl, 'getTokenAccountsByOwner', [
    walletAddress,
    { mint: TOKEN_MINT_ADDRESS },
    { encoding: 'jsonParsed' },
  ]);

  if (data.result && data.result.value && data.result.value.length > 0) {
    const info = data.result.value[0].account.data.parsed.info;
    return parseFloat(info.tokenAmount.uiAmountString || '0');
  }

  // Fallback: try Token-2022 program
  const data2022 = await queryRpc(rpcUrl, 'getTokenAccountsByOwner', [
    walletAddress,
    { programId: TOKEN_2022_PROGRAM_ID },
    { encoding: 'jsonParsed' },
  ]);

  if (data2022.result && data2022.result.value) {
    for (const account of data2022.result.value) {
      const info = account.account.data.parsed.info;
      if (info.mint === TOKEN_MINT_ADDRESS) {
        return parseFloat(info.tokenAmount.uiAmountString || '0');
      }
    }
  }

  return 0;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { walletAddress } = body;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return Response.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  // Validate wallet address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(walletAddress)) {
    return Response.json({ error: 'Invalid wallet address format' }, { status: 400 });
  }

  const errors = [];

  // Try each RPC endpoint with up to 2 retries each
  for (const rpcUrl of SOLANA_RPC_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(1000 * attempt);
        }

        const balance = await getTokenBalance(walletAddress, rpcUrl);

        return Response.json({
          balance,
          mint: TOKEN_MINT_ADDRESS,
        });
      } catch (err) {
        const msg = `${rpcUrl} attempt ${attempt + 1}: ${err.message}`;
        errors.push(msg);
        console.error(msg);
      }
    }
  }

  return Response.json(
    {
      error: 'Failed to check token balance after multiple attempts',
      details: errors,
      balance: null,
    },
    { status: 502 }
  );
};
