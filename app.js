// --- Configuration (UPDATE THESE!) ---
const ZART_TOKEN_CONTRACT_ADDRESS = "0x7F0c6e462e391E08625DAa30a83F40607867c706"; // Replace with your deployed ZARToken address on Sepolia
const ZART_TOKEN_ABI = [ // Replace with your ZARToken's ABI
    // --- Key ABI elements needed ---
    // Event for Transfer (standard ERC20)
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    // Functions
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address account) view returns (uint256)",
    // Add other functions/events from your ZARToken ABI if you need to interact with them
    // e.g., "function mintCooldown() view returns (uint256)"
];
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // Chain ID for Sepolia (11155111 in hex)
const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/wB7IOt6oAEAlkNMMXCaWtuSTOKbWQ2CB"; // e.g., from Alchemy or Infura

// --- DOM Elements ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const connectionStatusEl = document.getElementById('connectionStatus');
const userAccountEl = document.getElementById('userAccount');
const zartBalanceEl = document.getElementById('zartBalance');
const tokenAddressEl = document.getElementById('tokenAddress');
const tokenAddressLinkEl = document.getElementById('tokenAddressLink');
const tokenDecimalsEl = document.getElementById('tokenDecimals');
const buySellBtn = document.getElementById('buySellBtn');
const faucetBtn = document.getElementById('faucetBtn');
const actionInfoEl = document.getElementById('actionInfo');
const walletInfoDiv = document.getElementById('walletInfo');
const currentYearEl = document.getElementById('currentYear');

// --- Global State ---
let provider;
let signer;
let userAddress;
let zartTokenContract;
let tokenDecimals;

// --- Initialization ---
window.addEventListener('load', async () => {
    if (currentYearEl) {
        currentYearEl.textContent = new Date().getFullYear();
    }

    tokenAddressEl.textContent = ZART_TOKEN_CONTRACT_ADDRESS;
    tokenAddressLinkEl.href = `https://sepolia.etherscan.io/token/${ZART_TOKEN_CONTRACT_ADDRESS}`;

    // Light provider to read token info without wallet connection
    try {
        const lightProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL || `https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID`); // Fallback, replace YOUR_INFURA_PROJECT_ID
        const lightContract = new ethers.Contract(ZART_TOKEN_CONTRACT_ADDRESS, ZART_TOKEN_ABI, lightProvider);
        tokenDecimals = await lightContract.decimals();
        tokenDecimalsEl.textContent = tokenDecimals.toString();
    } catch (error) {
        console.error("Error fetching token decimals initially:", error);
        tokenDecimalsEl.textContent = "Error";
    }


    // Check if MetaMask or similar provider is available
    if (typeof window.ethereum !== 'undefined') {
        console.log('MetaMask is available!');
        provider = new ethers.BrowserProvider(window.ethereum);

        // Handle account changes
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log('Accounts changed:', accounts);
            if (accounts.length > 0) {
                handleConnectWallet(accounts[0]);
            } else {
                handleDisconnectWallet();
            }
        });

        // Handle chain changes
        window.ethereum.on('chainChanged', (chainId) => {
            console.log('Chain changed to:', chainId);
            // Reload or prompt user to switch to Sepolia
            if (chainId !== SEPOLIA_CHAIN_ID) {
                actionInfoEl.textContent = `Please switch to the Sepolia network in your wallet. Current: ${chainId}`;
                handleDisconnectWallet(); // Or just disable actions
            } else {
                actionInfoEl.textContent = "";
                // If an account was connected, re-initialize
                if (userAddress) {
                    handleConnectWallet(userAddress);
                }
            }
        });

        // Try to connect if already permitted (e.g., page refresh)
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await handleConnectWallet(accounts[0]);
            }
        } catch (error) {
            console.warn("Could not auto-connect:", error);
        }

    } else {
        connectionStatusEl.textContent = 'MetaMask (or a Web3 wallet) not detected.';
        connectWalletBtn.disabled = true;
        actionInfoEl.textContent = 'Please install MetaMask or use a Web3-enabled browser.';
    }

    connectWalletBtn.addEventListener('click', async () => {
        if (userAddress) { // If already connected, treat as disconnect
            handleDisconnectWallet();
        } else {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                await handleConnectWallet(accounts[0]);
            } catch (error) {
                console.error("Error connecting wallet:", error);
                connectionStatusEl.textContent = 'Connection failed.';
                actionInfoEl.textContent = `Error: ${error.message || 'User rejected connection.'}`;
            }
        }
    });

    // Placeholder button actions
    buySellBtn.addEventListener('click', () => {
        actionInfoEl.textContent = 'Buy/Sell functionality coming soon! This would integrate with a DEX.';
        // In a real app: window.location.href = '/dex-page.html'; or open a modal
    });

    faucetBtn.addEventListener('click', () => {
        actionInfoEl.textContent = 'Faucet functionality coming soon! This would allow claiming test ZART.';
        // In a real app: window.location.href = '/faucet-page.html'; or open a modal
    });
});

async function handleConnectWallet(account) {
    userAddress = account;
    connectionStatusEl.textContent = 'Connected';
    userAccountEl.textContent = userAddress;
    connectWalletBtn.textContent = 'Disconnect Wallet';
    walletInfoDiv.style.display = 'block';
    buySellBtn.disabled = false;
    faucetBtn.disabled = false;
    actionInfoEl.textContent = "";


    // Check network
    const network = await provider.getNetwork();
    if (network.chainId.toString() !== BigInt(SEPOLIA_CHAIN_ID).toString()) { // Compare as strings or BigInts
        actionInfoEl.textContent = `Please switch to the Sepolia network. Connected to chain ID: ${network.chainId}`;
        buySellBtn.disabled = true;
        faucetBtn.disabled = true;
        zartBalanceEl.textContent = "N/A (Wrong Network)";
        return; // Don't proceed if not on Sepolia
    }


    signer = await provider.getSigner();
    zartTokenContract = new ethers.Contract(ZART_TOKEN_CONTRACT_ADDRESS, ZART_TOKEN_ABI, signer);

    await updateZartBalance();
}

function handleDisconnectWallet() {
    userAddress = null;
    signer = null;
    zartTokenContract = null;
    connectionStatusEl.textContent = 'Disconnected';
    userAccountEl.textContent = 'N/A';
    zartBalanceEl.textContent = 'N/A';
    connectWalletBtn.textContent = 'Connect Wallet';
    walletInfoDiv.style.display = 'none';
    buySellBtn.disabled = true;
    faucetBtn.disabled = true;
}

async function updateZartBalance() {
    if (zartTokenContract && userAddress) {
        try {
            const balanceBigInt = await zartTokenContract.balanceOf(userAddress);
            if (!tokenDecimals) { // Fetch decimals if not fetched during init
                 const fetchedDecimals = await zartTokenContract.decimals();
                 tokenDecimals = Number(fetchedDecimals); // Convert BigInt to Number for ethers.formatUnits
                 tokenDecimalsEl.textContent = tokenDecimals.toString();
            }
            // Ensure tokenDecimals is a number before passing to formatUnits
            zartBalanceEl.textContent = ethers.formatUnits(balanceBigInt, Number(tokenDecimals));
        } catch (error) {
            console.error("Error fetching ZART balance:", error);
            zartBalanceEl.textContent = 'Error';
        }
    }
}
