import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { mnemonicToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import crypto from 'crypto';

// ANSI color codes
const yellow = '\x1b[33m';
const italic = '\x1b[3m';
const reset = '\x1b[0m';

// Load environment variables in specific order
// First load .env for main config
dotenv.config({ path: '.env' });

async function loadEnvLocal() {
  try {
    if (fs.existsSync('.env.local')) {
      const { loadLocal } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'loadLocal',
          message: 'Found .env.local, likely created by the install script - would you like to load its values?',
          default: false
        }
      ]);

      if (loadLocal) {
        console.log('Loading values from .env.local...');
        const localEnv = dotenv.parse(fs.readFileSync('.env.local'));
        
        // Copy all values except SEED_PHRASE to .env
        const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') + '\n' : '';
        let newEnvContent = envContent;
        
        for (const [key, value] of Object.entries(localEnv)) {
          if (key !== 'SEED_PHRASE') {
            // Update process.env
            process.env[key] = value;
            // Add to .env content if not already there
            if (!envContent.includes(`${key}=`)) {
              newEnvContent += `${key}="${value}"\n`;
            }
          }
        }
        
        // Write updated content to .env
        fs.writeFileSync('.env', newEnvContent);
        console.log('✅ Values from .env.local have been written to .env');
      }
    }

    // Always try to load SEED_PHRASE from .env.local
    if (fs.existsSync('.env.local')) {
      const localEnv = dotenv.parse(fs.readFileSync('.env.local'));
      if (localEnv.SEED_PHRASE) {
        process.env.SEED_PHRASE = localEnv.SEED_PHRASE;
      }
    }
  } catch (error) {
    // Error reading .env.local, which is fine
    console.log('Note: No .env.local file found');
  }
}

// TODO: make sure rebuilding is supported

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

async function validateDomain(domain) {
  // Remove http:// or https:// if present
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  
  // Basic domain validation
  if (!cleanDomain.match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/)) {
    throw new Error('Invalid domain format');
  }

  return cleanDomain;
}

async function validateSeedPhrase(seedPhrase) {
  try {
    // Try to create an account from the seed phrase
    const account = mnemonicToAccount(seedPhrase);
    return account.address;
  } catch (error) {
    throw new Error('Invalid seed phrase');
  }
}

async function generateFarcasterMetadata(domain, accountAddress, seedPhrase, webhookUrl) {
  const header = {
    type: 'custody',
    key: accountAddress,
  };
  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf-8').toString('base64');

  const payload = {
    domain
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');

  const account = mnemonicToAccount(seedPhrase);
  const signature = await account.signMessage({ 
    message: `${encodedHeader}.${encodedPayload}`
  });
  const encodedSignature = Buffer.from(signature, 'utf-8').toString('base64url');

  return {
    accountAssociation: {
      header: encodedHeader,
      payload: encodedPayload,
      signature: encodedSignature
    },
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_FRAME_NAME,
      iconUrl: `https://${domain}/icon.png`,
      homeUrl: `https://${domain}`,
      imageUrl: `https://${domain}/opengraph-image`,
      buttonTitle: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT,
      splashImageUrl: `https://${domain}/splash.png`,
      splashBackgroundColor: "#f7f7f7",
      webhookUrl,
    },
  };
}

async function main() {
  try {
    // Check for non-interactive flag
    const args = process.argv.slice(2);
    const nonInteractive = args.includes('--non-interactive');
    
    if (nonInteractive) {
      // Use default values
      console.log('Running in non-interactive mode with default values');
      const domain = process.env.NEXT_PUBLIC_URL?.replace('https://', '') || 'visionz-mini.vercel.app';
      const frameName = process.env.NEXT_PUBLIC_FRAME_NAME || 'VisionZ Retro';
      const buttonText = process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || 'Create Vision';
      
      // Update .env file with default values
      const envVars = [
        `NEXT_PUBLIC_URL="https://${domain}"`,
        `NEXT_PUBLIC_FRAME_NAME="${frameName}"`,
        `NEXT_PUBLIC_FRAME_BUTTON_TEXT="${buttonText}"`,
        `NEXT_PUBLIC_FRAME_HUB_SYNC=true`
      ];
      
      fs.writeFileSync('.env', envVars.join('\n') + '\n');
      console.log('✅ Updated .env file with default values');
      
      // Build the project
      console.log('\n🔨 Building your project...');
      execSync('npx next build', { stdio: 'inherit' });
      console.log('✅ Build completed');
      return;
    }

    console.log('\n📝 Checking environment variables...');
    console.log('Loading values from .env...');
    
    // Load .env.local if user wants to
    await loadEnvLocal();

    // Get domain from user
    const { domain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'domain',
        message: 'Enter the domain where your frame will be deployed (e.g., example.com):',
        validate: async (input) => {
          try {
            await validateDomain(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      }
    ]);

    // Get frame name from user
    const { frameName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'frameName',
        message: 'Enter the name for your frame (e.g., My Cool Frame):',
        default: process.env.NEXT_PUBLIC_FRAME_NAME,
        validate: (input) => {
          if (input.trim() === '') {
            return 'Frame name cannot be empty';
          }
          return true;
        }
      }
    ]);

    // Get button text from user
    const { buttonText } = await inquirer.prompt([
      {
        type: 'input',
        name: 'buttonText',
        message: 'Enter the text for your frame button:',
        default: process.env.NEXT_PUBLIC_FRAME_BUTTON_TEXT || 'Launch Frame',
        validate: (input) => {
          if (input.trim() === '') {
            return 'Button text cannot be empty';
          }
          return true;
        }
      }
    ]);

    // Get authentication details
    const { useSeedPhrase } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useSeedPhrase',
        message: 'Do you want to use a seed phrase for frame ownership (recommended)?',
        default: true,
      }
    ]);

    let seedPhrase;
    let accountAddress;

    if (useSeedPhrase) {
      let existingSeedPhrase = process.env.SEED_PHRASE;
      if (existingSeedPhrase) {
        const { useExistingSeedPhrase } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'useExistingSeedPhrase',
            message: 'Use existing seed phrase from .env or .env.local?',
            default: true,
          }
        ]);

        if (useExistingSeedPhrase) {
          seedPhrase = existingSeedPhrase;
          accountAddress = await validateSeedPhrase(seedPhrase);
          console.log(`✅ Using existing seed phrase with address ${accountAddress}`);
        } else {
          // Generate a new seed phrase
          let valid = false;
          while (!valid) {
            const { seedInput } = await inquirer.prompt([
              {
                type: 'password',
                name: 'seedInput',
                message: 'Enter your seed phrase (12 or 24 words):',
                validate: (input) => {
                  if (!input.trim()) {
                    return 'Seed phrase cannot be empty';
                  }
                  return true;
                }
              }
            ]);
            
            try {
              accountAddress = await validateSeedPhrase(seedInput);
              seedPhrase = seedInput;
              valid = true;
              console.log(`✅ Validated seed phrase with address ${accountAddress}`);
            } catch (error) {
              console.error(`❌ Invalid seed phrase: ${error.message}`);
            }
          }
        }
      } else {
        // No existing seed phrase, ask for a new one
        let valid = false;
        while (!valid) {
          const { seedInput } = await inquirer.prompt([
            {
              type: 'password',
              name: 'seedInput',
              message: 'Enter your seed phrase (12 or 24 words):',
              validate: (input) => {
                if (!input.trim()) {
                  return 'Seed phrase cannot be empty';
                }
                return true;
              }
            }
          ]);
          
          try {
            accountAddress = await validateSeedPhrase(seedInput);
            seedPhrase = seedInput;
            valid = true;
            console.log(`✅ Validated seed phrase with address ${accountAddress}`);
          } catch (error) {
            console.error(`❌ Invalid seed phrase: ${error.message}`);
          }
        }
      }
    }

    // Custom webhook URL option
    const { customWebhook } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'customWebhook',
        message: 'Do you want to specify a custom webhook URL for frame actions?',
        default: false
      }
    ]);

    let webhookUrl;
    if (customWebhook) {
      const { webhook } = await inquirer.prompt([
        {
          type: 'input',
          name: 'webhook',
          message: 'Enter your webhook URL:',
          validate: (input) => {
            try {
              new URL(input);
              return true;
            } catch (error) {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);
      webhookUrl = webhook;
    } else {
      webhookUrl = null;
    }

    // Generate Farcaster metadata
    let farcasterMetadata = null;
    if (seedPhrase && accountAddress) {
      farcasterMetadata = await generateFarcasterMetadata(domain, accountAddress, seedPhrase, webhookUrl);
      console.log('✅ Generated frame metadata');
    }

    // Write out the metadata file
    const metadataPath = 'farcaster.json';
    fs.writeFileSync(metadataPath, JSON.stringify(farcasterMetadata, null, 2));
    console.log(`✅ Wrote metadata to ${metadataPath}`);

    // Update .env file
    const envVars = [
      // App URL
      `NEXT_PUBLIC_URL="https://${domain}"`,
      // Frame info
      `NEXT_PUBLIC_FRAME_NAME="${frameName}"`,
      `NEXT_PUBLIC_FRAME_BUTTON_TEXT="${buttonText}"`,
      // Warpcast configuration (to enable hub sync in v2)
      `NEXT_PUBLIC_FRAME_HUB_SYNC=true`
    ];

    // Add seed phrase to local config, not pushed to git
    if (seedPhrase) {
      // Update/create .env.local with the seed phrase for local development
      let localEnvContent = fs.existsSync('.env.local') 
        ? fs.readFileSync('.env.local', 'utf8') 
        : '';
      
      if (!localEnvContent.includes('SEED_PHRASE=')) {
        localEnvContent += `\nSEED_PHRASE="${seedPhrase}"\n`;
      } else {
        // Replace existing seed phrase
        localEnvContent = localEnvContent.replace(
          /SEED_PHRASE=.*/,
          `SEED_PHRASE="${seedPhrase}"`
        );
      }
      
      fs.writeFileSync('.env.local', localEnvContent);
      console.log('✅ Updated .env.local with seed phrase');
    }

    // Write updated .env file
    fs.writeFileSync('.env', envVars.join('\n') + '\n');
    console.log('✅ Updated .env file');

    // Build the project
    console.log('\n🔨 Building your project...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed');

    console.log(`
🎉 Your frame is ready to be deployed!

To deploy it:
- If you already have vercel set up: Run 'npm run deploy:vercel'
- For a custom host, make sure to:
  1. Deploy the entire project
  2. Set the environment variables from .env in your hosting provider
  3. If you're using your own custom domain, make sure it matches the one you configured: ${domain}
`);

  } catch (error) {
    console.error('❌ Error building the project:', error);
    process.exit(1);
  }
}

main().catch(console.error);
