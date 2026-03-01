/* ===== Neuronox AI — Wallet-Gated Chat ===== */

(function () {
  'use strict';

  // ── Configuration ──
  const REQUIRED_TOKEN_AMOUNT = 10;
  const TOKEN_MINT_ADDRESS = '8f7ZpbkLTevSVhFL6XxAwkQCWoMXGiU4P1uqD6pwpump';
  const BALANCE_API = '/.netlify/functions/check-balance';

  // ── State ──
  let walletAddress = null;
  let chatUnlocked = false;

  // ── DOM Elements ──
  const connectBtn = document.getElementById('connectWalletBtn');
  const walletStatusText = document.getElementById('walletStatus');
  const statusIndicator = document.getElementById('statusIndicator');
  const tokenStatus = document.getElementById('tokenStatus');
  const chatBadge = document.getElementById('chatBadge');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const chatLockOverlay = document.getElementById('chatLockOverlay');
  const lockMessage = document.getElementById('lockMessage');

  // ── Background Particles ──
  function createParticles() {
    const container = document.getElementById('bgParticles');
    if (!container) return;
    const colors = ['var(--neon-blue)', 'var(--neon-purple)'];
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      const size = Math.random() * 4 + 2;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDuration = (Math.random() * 20 + 15) + 's';
      particle.style.animationDelay = (Math.random() * 10) + 's';
      container.appendChild(particle);
    }
  }

  // ── Wallet Connection ──
  connectBtn.addEventListener('click', async function () {
    // Check for Phantom or compatible Solana wallet
    const provider = getWalletProvider();

    if (provider) {
      try {
        const resp = await provider.connect();
        walletAddress = resp.publicKey.toString();
        onWalletConnected(walletAddress);
        await checkTokenBalance(walletAddress);
      } catch (err) {
        console.error('Wallet connection error:', err);
        if (err.code === 4001) {
          showWalletError('Connection rejected by user.');
        }
      }
    } else {
      // No wallet detected — use demo mode
      activateDemoMode();
    }
  });

  function getWalletProvider() {
    if (window.solana && window.solana.isPhantom) {
      return window.solana;
    }
    if (window.phantom && window.phantom.solana) {
      return window.phantom.solana;
    }
    return null;
  }

  function onWalletConnected(address) {
    const short = address.slice(0, 4) + '...' + address.slice(-4);
    walletStatusText.textContent = short;
    statusIndicator.classList.add('connected');
    connectBtn.innerHTML = '<span class="btn-icon">✓</span> Connected';
    connectBtn.classList.add('connected');
    connectBtn.disabled = true;
  }

  function showWalletError(msg) {
    tokenStatus.textContent = msg;
    tokenStatus.className = 'token-status insufficient';
    tokenStatus.classList.remove('hidden');
  }

  // ── Token Balance Check ──
  async function checkTokenBalance(address) {
    tokenStatus.classList.remove('hidden');
    tokenStatus.textContent = 'Checking Neuronox token balance...';
    tokenStatus.className = 'token-status';

    try {
      const response = await fetch(BALANCE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Balance check failed');
      }

      var balance = data.balance;

      if (typeof balance !== 'number') {
        throw new Error('Invalid balance response');
      }

      if (balance >= REQUIRED_TOKEN_AMOUNT) {
        unlockChat(balance);
      } else {
        lockChat(balance);
      }
    } catch (err) {
      console.error('Token balance check failed:', err);
      tokenStatus.textContent = 'Could not verify token balance. Please try again.';
      tokenStatus.className = 'token-status insufficient';

      // Re-enable the connect button so user can retry
      connectBtn.disabled = false;
      connectBtn.innerHTML = '<span class="btn-icon">↻</span> Retry';
      connectBtn.classList.remove('connected');
    }
  }

  function unlockChat(balance) {
    chatUnlocked = true;
    tokenStatus.textContent = '✓ ' + balance + ' Neuronox tokens detected — AI access granted';
    tokenStatus.className = 'token-status sufficient';
    chatBadge.textContent = 'Unlocked';
    chatBadge.classList.add('unlocked');
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatLockOverlay.classList.add('hidden');
    chatInput.placeholder = 'Ask Neuronox AI anything...';
    chatInput.focus();

    // Clear welcome message
    chatMessages.innerHTML = '';
    addAIMessage('Welcome! I\'m Neuronox AI. Ask me anything about crypto, DeFi, or blockchain technology.');
  }

  function lockChat(balance) {
    chatUnlocked = false;
    tokenStatus.textContent = 'Balance: ' + balance + ' Neuronox — need at least ' + REQUIRED_TOKEN_AMOUNT + ' tokens';
    tokenStatus.className = 'token-status insufficient';
    lockMessage.textContent = 'Hold ' + REQUIRED_TOKEN_AMOUNT + ' Neuronox tokens to unlock AI access';
    chatInput.disabled = true;
    sendBtn.disabled = true;
  }

  // ── Demo Mode (no wallet extension) ──
  function activateDemoMode() {
    const demoAddress = '7xKp...demo';
    walletStatusText.textContent = demoAddress + ' (Demo)';
    statusIndicator.classList.add('connected');
    connectBtn.innerHTML = '<span class="btn-icon">✓</span> Demo Mode';
    connectBtn.classList.add('connected');
    connectBtn.disabled = true;

    tokenStatus.classList.remove('hidden');
    tokenStatus.textContent = '✓ Demo mode — AI access granted (no wallet extension detected)';
    tokenStatus.className = 'token-status sufficient';

    chatUnlocked = true;
    chatBadge.textContent = 'Demo';
    chatBadge.classList.add('unlocked');
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatLockOverlay.classList.add('hidden');
    chatInput.placeholder = 'Ask Neuronox AI anything...';

    chatMessages.innerHTML = '';
    addAIMessage('Welcome! Running in demo mode (no Solana wallet detected). Ask me anything about crypto, DeFi, or blockchain.');
  }

  // ── Chat Functionality ──
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function sendMessage() {
    if (!chatUnlocked) return;
    const text = chatInput.value.trim();
    if (!text) return;

    addUserMessage(text);
    chatInput.value = '';
    chatInput.focus();

    // Show typing indicator
    const typingEl = showTypingIndicator();

    // Simulate AI response
    const delay = 800 + Math.random() * 1200;
    setTimeout(function () {
      typingEl.remove();
      const reply = generateAIResponse(text);
      addAIMessage(reply);
    }, delay);
  }

  function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = '<span class="message-label">You</span>' + escapeHtml(text);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function addAIMessage(text) {
    const div = document.createElement('div');
    div.className = 'message ai';
    div.innerHTML = '<span class="message-label">Neuronox AI</span>' + escapeHtml(text);
    chatMessages.appendChild(div);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'message ai';
    div.innerHTML =
      '<span class="message-label">Neuronox AI</span>' +
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    scrollToBottom();
    return div;
  }

  function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── AI Response Generator (demo) ──
  function generateAIResponse(input) {
    var lower = input.toLowerCase();

    if (lower.includes('bitcoin') || lower.includes('btc')) {
      return 'Bitcoin remains the leading cryptocurrency by market cap. It operates on a proof-of-work consensus mechanism and serves as a store of value in the digital economy. What specific aspect of Bitcoin would you like to know more about?';
    }
    if (lower.includes('solana') || lower.includes('sol')) {
      return 'Solana is a high-performance Layer 1 blockchain known for fast transaction speeds and low fees. It uses a unique proof-of-history consensus combined with proof-of-stake. The ecosystem continues to grow with DeFi, NFTs, and meme tokens.';
    }
    if (lower.includes('ethereum') || lower.includes('eth')) {
      return 'Ethereum is the leading smart contract platform and the backbone of DeFi. After transitioning to proof-of-stake with The Merge, it significantly reduced energy consumption. Layer 2 solutions like Arbitrum and Optimism help scale the network.';
    }
    if (lower.includes('defi')) {
      return 'DeFi (Decentralized Finance) enables financial services like lending, borrowing, and trading without intermediaries. Key protocols include Aave, Uniswap, and Compound. Always research thoroughly and understand the risks before participating.';
    }
    if (lower.includes('nft')) {
      return 'NFTs (Non-Fungible Tokens) represent unique digital assets on the blockchain. While the speculative art market has cooled, NFTs are finding real utility in gaming, ticketing, identity verification, and digital ownership.';
    }
    if (lower.includes('neuronox')) {
      return 'Neuronox is an AI-powered crypto project built on Solana. By holding Neuronox tokens, you gain access to AI tools, analytics, and this chat interface. The token serves as a utility and governance token within the ecosystem.';
    }
    if (lower.includes('wallet')) {
      return 'Crypto wallets store your private keys and allow you to interact with blockchains. Popular options include Phantom (Solana), MetaMask (Ethereum), and hardware wallets like Ledger for maximum security. Never share your seed phrase with anyone.';
    }
    if (lower.includes('price') || lower.includes('market')) {
      return 'I can provide general market insights, but please note that cryptocurrency prices are highly volatile. Always do your own research (DYOR) and never invest more than you can afford to lose. Check real-time data on platforms like CoinGecko or CoinMarketCap.';
    }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return 'Hello! I\'m Neuronox AI, your crypto and blockchain assistant. Ask me about Bitcoin, Ethereum, Solana, DeFi, NFTs, or anything else in the Web3 space.';
    }
    if (lower.includes('help')) {
      return 'I can help with: cryptocurrency analysis, blockchain concepts, DeFi protocols, wallet setup, token economics, smart contracts, and general Web3 questions. Just ask away!';
    }
    if (lower.includes('staking')) {
      return 'Staking allows you to earn rewards by locking up your tokens to help secure a proof-of-stake network. Popular staking options include ETH staking, SOL staking, and various DeFi yield farming protocols. APY varies by protocol and network conditions.';
    }

    // Default responses
    var defaults = [
      'That\'s an interesting question. In the crypto space, it\'s important to consider both the technical fundamentals and market dynamics. Could you provide more details so I can give a more specific answer?',
      'Great question! The blockchain ecosystem is constantly evolving. Let me share some perspective: always evaluate projects based on their technology, team, community, and real-world utility rather than just price action.',
      'I appreciate your curiosity! The Web3 landscape offers many opportunities. I\'d recommend diving deeper into the specific area you\'re interested in. Feel free to ask about DeFi, NFTs, Layer 1s, or any specific protocol.',
      'That\'s worth exploring further. In crypto, knowledge is your best investment. I\'d suggest looking into the underlying technology and use cases. What specific aspect would you like me to elaborate on?'
    ];

    return defaults[Math.floor(Math.random() * defaults.length)];
  }

  // ── Initialize ──
  createParticles();

})();
