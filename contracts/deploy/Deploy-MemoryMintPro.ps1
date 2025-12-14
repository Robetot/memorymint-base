# ============================================================
# MemoryMintPro Deployment Script for Base Mainnet
# ============================================================
# 
# This PowerShell script deploys the MemoryMintPro contract to Base Mainnet
# Supports: Private Key, Mnemonic, or Keystore file authentication
#
# Prerequisites:
# 1. Install Foundry: https://book.getfoundry.sh/getting-started/installation
# 2. Have ETH on Base Mainnet for gas fees
# 3. Contract compiled with: forge build
#
# Usage:
#   .\Deploy-MemoryMintPro.ps1 -AuthMethod "privatekey" -PrivateKey "0x..."
#   .\Deploy-MemoryMintPro.ps1 -AuthMethod "mnemonic" -Mnemonic "word1 word2..."
#   .\Deploy-MemoryMintPro.ps1 -AuthMethod "keystore" -KeystorePath "path/to/keystore.json"
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("privatekey", "mnemonic", "keystore")]
    [string]$AuthMethod,
    
    [Parameter(Mandatory=$false)]
    [string]$PrivateKey,
    
    [Parameter(Mandatory=$false)]
    [string]$Mnemonic,
    
    [Parameter(Mandatory=$false)]
    [string]$KeystorePath,
    
    [Parameter(Mandatory=$false)]
    [string]$KeystorePassword,
    
    # Contract constructor arguments
    [Parameter(Mandatory=$false)]
    [string]$Name = "MemoryMint",
    
    [Parameter(Mandatory=$false)]
    [string]$Symbol = "MMINT",
    
    [Parameter(Mandatory=$false)]
    [string]$BaseURI = "ipfs://",
    
    # Network configuration
    [Parameter(Mandatory=$false)]
    [string]$RpcUrl = "https://mainnet.base.org",
    
    [Parameter(Mandatory=$false)]
    [switch]$Verify,
    
    [Parameter(Mandatory=$false)]
    [string]$BasescanApiKey,
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun
)

# ============================================================
# Configuration
# ============================================================
$ErrorActionPreference = "Stop"
$ContractName = "MemoryMintPro"
$ContractPath = "contracts/$ContractName.sol:$ContractName"
$ChainId = 8453  # Base Mainnet

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host $msg -ForegroundColor Red }

# ============================================================
# Banner
# ============================================================
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                  MemoryMintPro Deployer                  ║
║           Gas-Optimized NFT Contract for Base            ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Magenta

# ============================================================
# Validation
# ============================================================
Write-Info "🔍 Validating configuration..."

# Check Foundry installation
if (-not (Get-Command "forge" -ErrorAction SilentlyContinue)) {
    Write-Err "❌ Foundry not found. Install from: https://book.getfoundry.sh/getting-started/installation"
    exit 1
}

# Validate authentication method
switch ($AuthMethod) {
    "privatekey" {
        if ([string]::IsNullOrEmpty($PrivateKey)) {
            Write-Err "❌ Private key required. Use -PrivateKey parameter"
            exit 1
        }
        if (-not $PrivateKey.StartsWith("0x")) {
            $PrivateKey = "0x$PrivateKey"
        }
        $AuthArgs = "--private-key $PrivateKey"
    }
    "mnemonic" {
        if ([string]::IsNullOrEmpty($Mnemonic)) {
            Write-Err "❌ Mnemonic required. Use -Mnemonic parameter"
            exit 1
        }
        $AuthArgs = "--mnemonic `"$Mnemonic`""
    }
    "keystore" {
        if ([string]::IsNullOrEmpty($KeystorePath)) {
            Write-Err "❌ Keystore path required. Use -KeystorePath parameter"
            exit 1
        }
        if (-not (Test-Path $KeystorePath)) {
            Write-Err "❌ Keystore file not found: $KeystorePath"
            exit 1
        }
        $AuthArgs = "--keystore `"$KeystorePath`""
        if (-not [string]::IsNullOrEmpty($KeystorePassword)) {
            $AuthArgs += " --password `"$KeystorePassword`""
        }
    }
}

# Validate verification requirements
if ($Verify -and [string]::IsNullOrEmpty($BasescanApiKey)) {
    Write-Warn "⚠️ Verification requested but no Basescan API key provided"
    Write-Warn "   Get one from: https://basescan.org/myapikey"
}

Write-Success "✅ Configuration validated"

# ============================================================
# Compile Contract
# ============================================================
Write-Info "`n📦 Compiling contract..."

$CompileResult = forge build --contracts contracts/$ContractName.sol 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Err "❌ Compilation failed:"
    Write-Err $CompileResult
    exit 1
}

Write-Success "✅ Contract compiled successfully"

# ============================================================
# Estimate Gas
# ============================================================
Write-Info "`n⛽ Estimating deployment gas..."

# Get current gas price from Base
try {
    $GasPrice = (Invoke-RestMethod -Uri $RpcUrl -Method Post -ContentType "application/json" -Body '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}').result
    $GasPriceGwei = [math]::Round([Convert]::ToInt64($GasPrice, 16) / 1e9, 4)
    Write-Info "   Current gas price: $GasPriceGwei Gwei"
} catch {
    Write-Warn "   Could not fetch gas price, using estimates"
    $GasPriceGwei = 0.001  # Base is very cheap
}

# Estimated deployment gas for this contract
$EstimatedGas = 2000000
$EstimatedCostEth = [math]::Round(($EstimatedGas * $GasPriceGwei) / 1e9, 8)
Write-Info "   Estimated gas: ~$EstimatedGas"
Write-Info "   Estimated cost: ~$EstimatedCostEth ETH"

# ============================================================
# Deploy Contract
# ============================================================
Write-Info "`n🚀 Deploying $ContractName to Base Mainnet..."
Write-Info "   Name: $Name"
Write-Info "   Symbol: $Symbol"
Write-Info "   Base URI: $BaseURI"
Write-Info "   Chain ID: $ChainId"
Write-Host ""

if ($DryRun) {
    Write-Warn "🔸 DRY RUN MODE - Not actually deploying"
    Write-Info "   Would run: forge create $ContractPath --rpc-url $RpcUrl --constructor-args `"$Name`" `"$Symbol`" `"$BaseURI`""
    exit 0
}

# Build deployment command
$DeployCmd = "forge create $ContractPath --rpc-url $RpcUrl $AuthArgs --constructor-args `"$Name`" `"$Symbol`" `"$BaseURI`""

if ($Verify -and -not [string]::IsNullOrEmpty($BasescanApiKey)) {
    $DeployCmd += " --verify --etherscan-api-key $BasescanApiKey"
}

# Add gas optimizations
$DeployCmd += " --optimize --optimizer-runs 200"

# Execute deployment
Write-Info "Executing deployment..."
$DeployOutput = Invoke-Expression $DeployCmd 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Err "❌ Deployment failed:"
    Write-Err $DeployOutput
    exit 1
}

# Parse contract address from output
$ContractAddress = ($DeployOutput | Select-String -Pattern "Deployed to: (0x[a-fA-F0-9]{40})" | ForEach-Object { $_.Matches[0].Groups[1].Value })
$TxHash = ($DeployOutput | Select-String -Pattern "Transaction hash: (0x[a-fA-F0-9]{64})" | ForEach-Object { $_.Matches[0].Groups[1].Value })

# ============================================================
# Output Results
# ============================================================
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                  🎉 DEPLOYMENT SUCCESS! 🎉               ║
╚══════════════════════════════════════════════════════════╝

"@ -ForegroundColor Green

Write-Success "Contract Address: $ContractAddress"
Write-Success "Transaction Hash: $TxHash"
Write-Info "`nView on Basescan:"
Write-Info "   https://basescan.org/address/$ContractAddress"
Write-Info "`nView Transaction:"
Write-Info "   https://basescan.org/tx/$TxHash"

# ============================================================
# Save Deployment Info
# ============================================================
$DeploymentInfo = @{
    contractName = $ContractName
    address = $ContractAddress
    transactionHash = $TxHash
    network = "Base Mainnet"
    chainId = $ChainId
    constructorArgs = @{
        name = $Name
        symbol = $Symbol
        baseURI = $BaseURI
    }
    deployedAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC")
    verified = $Verify
}

$DeploymentPath = "contracts/deploy/deployment-$((Get-Date -Format 'yyyyMMdd-HHmmss')).json"
$DeploymentInfo | ConvertTo-Json -Depth 3 | Set-Content -Path $DeploymentPath
Write-Info "`nDeployment info saved to: $DeploymentPath"

# ============================================================
# Next Steps
# ============================================================
Write-Host @"

╔══════════════════════════════════════════════════════════╗
║                      NEXT STEPS                          ║
╚══════════════════════════════════════════════════════════╝

1. Update frontend with new contract address:
   Edit: src/hooks/useNFTMint.ts
   Set: NFT_CONTRACT_ADDRESS = "$ContractAddress"

2. Verify contract on Basescan (if not done):
   forge verify-contract $ContractAddress $ContractPath --chain-id $ChainId --etherscan-api-key YOUR_API_KEY

3. Test minting:
   cast send $ContractAddress "mintNFT(string)" "ipfs://test" --rpc-url $RpcUrl --private-key YOUR_KEY

"@ -ForegroundColor Cyan

Write-Success "`n✅ Deployment complete!"
