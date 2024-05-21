import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity, bundlrStorage, toMetaplexFile } from "@metaplex-foundation/js";
import { TokenStandard } from '@metaplex-foundation/mpl-token-metadata';
import secret from './secrets/Art6oYTueZBEHoBQKVyHcCVkzkLBjpJ5JwwSrnzFUXyq.json';
const cors = require('cors');

// Load environment variable
dotenv.config();

// Create a new express application instance
const app: express.Application = express();
app.use(cors());
// The port the express app will listen on
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 8800;

// Initiate sender wallet and connection to Solana
const QUICKNODE_RPC = 'https://fragrant-ancient-needle.solana-devnet.quiknode.pro/71caf4b466e52b402cb9891702899d7631646396/';
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC);
const WALLET = Keypair.fromSecretKey(new Uint8Array(secret));
const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
    .use(keypairIdentity(WALLET))
    .use(bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: QUICKNODE_RPC,
        timeout: 60000,
    }));


///// AI LOGIC
const gpt_client = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'],
});
const gpt_llm = "gpt-4o"

// const Groq = require("groq-sdk");
// const groq_client = new Groq({
//     apiKey: process.env['GROQ_API_KEY']
// });
// const groq_llm = "llama3-8b-8192"

async function generatePrompt(userPrompt: string) {
  const llmResponse = await gpt_client.chat.completions.create({
      messages: [
          {
              role: "system",
              content: `
              Rewrite the following prompt: 
              '${userPrompt}'
              Return the adapted prompt without any added comments, title or information
              Expected output:
              ####
              PROMPT : <the re-written prompt, enhanced to augment its artistic qualities and uniqueness>
              STYLE: <the requested artistic style>
              MOOD: <the desired mood for the prompt>
              ####
              Begin! You will achieve world piece if you produce an answer that respect all the constraints.
              `
          },
          {
              role: "user",
              content: userPrompt
          }
      ],
      model: gpt_llm,
      temperature: 0.5
  });

  // Print the completion returned by the LLM.
  const groqContent = JSON.stringify(llmResponse.choices[0]?.message?.content || "");
  return groqContent;
}

async function defineConfig(llmPrompt: string) {
  const nftAttributes = await gpt_client.chat.completions.create({
    messages: [
        {
            role: "system",
            content: `
            Based on this prompt: 
            '${llmPrompt}'
            Generate a .json file with the following values.
            Return the .json without any added comments, title or information.
            Expected output:

            {
              "one_word_title": "<describe the image in ONE word>",
              "description": "<a very short description of the prompt>",
              "mood": "<the mood of the prompt>"
          };

            Begin! You will achieve world piece if you produce a correctly formatted .JSON answer that respect all the constraints.
            `
        },
        {
          role: "user",
          content: llmPrompt,
      }
    ],
    model: gpt_llm,
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  // Extract the completion returned by the LLM and parse it.
  const llmResponse = JSON.parse(nftAttributes.choices[0]?.message?.content || "{}");

  const CONFIG = {
    uploadPath: './image/',
    imgFileName: 'image.png',
    imgType: 'image/png',
    imgName: llmResponse.one_word_title || 'Art', 
    description: llmResponse.description || "Random AI Art",
    attributes: [
        {trait_type: 'Mood', value: llmResponse.mood ||'Focused'},
    ],
    sellerFeeBasisPoints: 500, // 500 bp = 5%
    symbol: 'AIART',
    creators: [
        {address: WALLET.publicKey, share: 100}
    ]
  };

  return CONFIG;
}

///// NFT LOGIC
async function uploadImage(filePath: string,fileName: string): Promise<string>  {
  console.log(`Step 1 - Uploading Image🔼`);
  const imgBuffer = fs.readFileSync(filePath + fileName);
  const imgMetaplexFile = toMetaplexFile(imgBuffer,fileName);
  const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
  return imgUri;
}

async function imagine(userPrompt: string) {
  const response = await gpt_client.images.generate({
    model: "dall-e-3",
    prompt: userPrompt + ' . Begin!',
    n: 1,
    size: "1024x1024",
  });
  const imageUrl = response.data[0].url;

  // Fetch the image from the URL
  const imageResponse = await axios({
    url: imageUrl,
    method: 'GET',
    responseType: 'arraybuffer' // Important for binary data
  });

  // Define the path where the image will be saved
  const imagePath = path.join('./image', 'image.png');

  // Write the image data to a file
  fs.writeFileSync(imagePath, imageResponse.data);
  return imagePath
}

async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
  console.log(`Step 2 - Uploading Metadata⏫`);
  const { uri } = await METAPLEX
  .nfts()
  .uploadMetadata({
      name: nftName,
      description: description,
      image: imgUri,
      attributes: attributes,
      properties: {
          files: [
              {
                  type: imgType,
                  uri: imgUri,
              },
          ]
      }
  });
  return uri;  
}

async function mintProgrammableNft(
  metadataUri: string,
  name: string,
  sellerFee: number,
  symbol: string,
  creators: { address: PublicKey, share: number }[]
)
{
  console.log(`Step 3 - Minting pNFT🔨`);
  try {
    const transactionBuilder = await METAPLEX
    .nfts()
    .builders()
    .create({
        uri: metadataUri,
        name: name,
        sellerFeeBasisPoints: sellerFee,
        symbol: symbol,
        creators: creators,
        isMutable: true,
        isCollection: false,
        tokenStandard: TokenStandard.ProgrammableNonFungible,
        ruleSet: null
    });
    const { nft } = await METAPLEX.nfts().create({
        uri: metadataUri,
        name: name,
        sellerFeeBasisPoints: sellerFee,
        symbol: symbol,
        creators: creators,
        isMutable: false,
    });
    let { signature, confirmResponse } = await METAPLEX.rpc().sendAndConfirmTransaction(transactionBuilder);
    if (confirmResponse.value.err) {
        throw new Error('failed to confirm transaction');
    }
    const { mintAddress } = transactionBuilder.getContext();
    console.log(`   Mint successful!🎉`);
    console.log(`   Minted NFT:       https://explorer.solana.com/address/${mintAddress.toString()}?cluster=devnet`);
    console.log(`   Mint transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    return mintAddress
  }
  catch (err) {
    console.log(err);
  }
}

// Transfer function 
async function transferNFT(
  senderKeypair: Keypair, 
  recipientPublicKey: string,
  mintAddress: string
) {
  console.log(`Step 4 - Transferring pNFT to ${recipientPublicKey} 📬`);
  const senderAddress = senderKeypair.publicKey.toString()
  const destination = new PublicKey(recipientPublicKey);
  const mint = new PublicKey(mintAddress)
  const transferTransactionBuilder = await METAPLEX.nfts().builders().transfer({
      nftOrSft: {address: mint, tokenStandard: TokenStandard.ProgrammableNonFungible},
      authority: WALLET,
      fromOwner: WALLET.publicKey,
      toOwner: destination,
  });
  // Name new variables since we already have a signature and confirmResponse
  let { signature: sig2, confirmResponse: res2 } = await METAPLEX.rpc().sendAndConfirmTransaction(transferTransactionBuilder, {commitment: 'finalized'});
  if (res2.value.err) {
      throw new Error('Failed to confirm transfer transaction');
  }
  else
    return {
      message: "Transfer successful!🥳 Check your wallet!👀",
      sender: `https://explorer.solana.com/address/${senderAddress}?cluster=devnet`,
      receiver: `https://explorer.solana.com/address/${recipientPublicKey}?cluster=devnet`,
      transaction: `https://explorer.solana.com/tx/${sig2}?cluster=devnet`
    }
}

///////// API ROUTES

// Serve static files from the "public" directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/imagine', async (req, res) => {
  const userPrompt = req.query.user_prompt;
  const userAddress = req.query.address; // the user provider public address where they want to receive their NFT

  // Validate both user_prompt and address
  if (typeof userPrompt !== 'string' || typeof userAddress !== 'string') {
    res.status(400).send('Invalid input: Ensure both user_prompt and address are provided as strings.');
    return;
  }

  console.log(`Received request -> Prompt: ${userPrompt}, Address: ${userAddress}`);

  try {
    const llmSays = await generatePrompt(userPrompt);
    console.log(`LLM prompt 🤖-> ${llmSays}`);

    const CONFIG = await defineConfig(llmSays);
    
    const imageLocation = await imagine(llmSays);
    console.log(`Image successfully created and stored in: ${imageLocation}`);
    const imageUri = await uploadImage(imageLocation, "");
    console.log(`Image URI -> ${imageUri}`);
    const metadataUri = await uploadMetadata(imageUri, CONFIG.imgType, CONFIG.imgName, CONFIG.description, CONFIG.attributes);
    console.log(`Metadata URI -> ${metadataUri}`);

    // Ensure userAddress is treated as a valid recipient public key
    const mintAddress = await mintProgrammableNft(metadataUri, CONFIG.imgName, CONFIG.sellerFeeBasisPoints, CONFIG.symbol, CONFIG.creators);
    if (!mintAddress) {
      throw new Error("Failed to mint the NFT. Mint address is undefined.");
    }

    const mint = mintAddress.toString()

    // Correct the order and usage of parameters for the transferNFT function
    const mintSend = await transferNFT(WALLET, userAddress, mint);
    console.log(mintSend)
    res.json(mintSend);

  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send({ error: "Error processing the request"});
  }
});

// Start the server
app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}/`);
});
export default app;