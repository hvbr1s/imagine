import * as fs from 'graceful-fs';
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
import cors from 'cors';
import { EventEmitter } from 'events';
import Instructor from "@instructor-ai/instructor";
import { z } from "zod"


// Load environment variable
dotenv.config();

// Create a new express application instance
const app: express.Application = express();
app.use(cors());
// The port the express app will listen on
const port: number = process.env.PORT ? parseInt(process.env.PORT) : 8800;

// Function to convert private key string to Uint8Array
function getKeypairFromEnvironment(): Keypair {
  const privateKeyString = process.env.MINTER_PRIVATE_KEY;
  if (!privateKeyString) {
    throw new Error('Minter key is not set in environment variables');
  }
  // Convert the private key string to an array of numbers
  const privateKeyArray = privateKeyString.split(',').map(num => parseInt(num, 10));
  // Create a Uint8Array from the array of numbers
  const privateKeyUint8Array = new Uint8Array(privateKeyArray);
  // Create and return the Keypair
  return Keypair.fromSecretKey(privateKeyUint8Array);
}

// Initiate sender wallet and connection to Solana
const QUICKNODE_RPC = 'https://fragrant-ancient-needle.solana-devnet.quiknode.pro/71caf4b466e52b402cb9891702899d7631646396/';
const SOLANA_CONNECTION = new Connection(QUICKNODE_RPC);
const WALLET = getKeypairFromEnvironment();
const METAPLEX = Metaplex.make(SOLANA_CONNECTION)
    .use(keypairIdentity(WALLET))
    .use(bundlrStorage({
        address: 'https://devnet.bundlr.network',
        providerUrl: QUICKNODE_RPC,
        timeout: 60000,
    }));

///// EVENT LOGIC

const progressEmitter = new EventEmitter();

app.get('/progress', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendProgress = (data:any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  progressEmitter.on('progress', sendProgress);

  req.on('close', () => {
    progressEmitter.off('progress', sendProgress);
  });
});

///// AI LOGIC
const oai_client = new OpenAI({apiKey: process.env['OPENAI_API_KEY']});
const gpt_llm = "gpt-4o"

///// Prepare Instructor
const instructor_client = Instructor({
  client: oai_client,
  mode: "FUNCTIONS"
})

const UserSchema = z.object({
  prompt: z.string(), 
  safety: z.string().describe("Is the prompt 'safe' or 'unsafe'? An unsafe prompt contains reference to sexual violence, child abuse or scams. A safe prompt does not")
})

async function safePrompting(userPrompt: string){
  const llmSafetyCheck = await instructor_client.chat.completions.create({
    messages: [
        {
            role: "user",
            content: userPrompt
        }
    ],
    model: gpt_llm,
    temperature: 0.0,
    response_model: { 
      schema: UserSchema, 
      name: "Safety Check"
    }
  });

// Print the completion returned by the LLM.
const safetyCheckResponse = llmSafetyCheck.safety.toLowerCase();
return safetyCheckResponse;
}

async function generatePrompt(userPrompt: string) {
  const llmResponse = await oai_client.chat.completions.create({
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
  const parsedresponse = JSON.stringify(llmResponse.choices[0]?.message?.content || "");
  return parsedresponse;
}

async function defineConfig(llmPrompt: string, randomNumber: number) {
  const nftAttributes = await oai_client.chat.completions.create({
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
              "mood": "<the mood of the prompt>",
              "haiku" "<a very short haiku based on the prompt>"
          };

            Begin! You will achieve world peace if you produce a correctly formatted .JSON answer that respect all the constraints.
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
    imgFileName: `image${randomNumber}.png`,
    imgType: 'image/png',
    imgName: llmResponse.one_word_title || 'Art', 
    description: llmResponse.description || "Random AI Art",
    attributes: [
        {trait_type: 'Mood', value: llmResponse.mood ||''},
        {trait_type: 'Haiku', value:llmResponse.haiku ||''},
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
  const imgBuffer = fs.readFileSync(filePath + fileName);
  const imgMetaplexFile = toMetaplexFile(imgBuffer,fileName);
  const imgUri = await METAPLEX.storage().upload(imgMetaplexFile);
  return imgUri;
}

async function imagine(userPrompt: string, randomNumber: number) {
  const response = await oai_client.images.generate({
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
    responseType: 'arraybuffer'
  });

  const imagePath = path.join('./image', `image_${randomNumber}.png`);

  // Write the image data to a file
  fs.writeFileSync(imagePath, imageResponse.data);
  return imagePath
}

async function uploadMetadata(imgUri: string, imgType: string, nftName: string, description: string, attributes: {trait_type: string, value: string}[]) {
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
  const senderAddress = senderKeypair.publicKey.toString()
  const destination = new PublicKey(recipientPublicKey);
  const mint = new PublicKey(mintAddress)
  const accountInfo = await SOLANA_CONNECTION.getAccountInfo(new PublicKey(mint));
  if (accountInfo) {
    console.log(`Current Owner of the NFT: ${accountInfo.owner.toString()}`);
  } else {
    console.log('Account info is null.');
  }
  const transferTransactionBuilder = await METAPLEX.nfts().builders().transfer({
      nftOrSft: {address: mint, tokenStandard: TokenStandard.ProgrammableNonFungible},
      authority: WALLET,
      fromOwner: WALLET.publicKey,
      toOwner: destination,
  });
  
  let { signature: sig2, confirmResponse: res2 } = await METAPLEX.rpc().sendAndConfirmTransaction(transferTransactionBuilder, {commitment: 'finalized'});
  if (res2.value.err) {
      throw new Error('Failed to confirm transfer transaction');
  }
  else
    return {
      message: "Transfer successful!🥳",
      sender: `https://explorer.solana.com/address/${senderAddress}?cluster=devnet`,
      receiver: `https://explorer.solana.com/address/${recipientPublicKey}/tokens?cluster=devnet`,
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
    progressEmitter.emit('progress', { step: 0, message: "Let's begin! 🪄" });
    // Assign unique number to project
    const randomNumber = Math.floor(Math.random() * 10000);

    // Safety check
    progressEmitter.emit('progress', { step: 1, message: "Checking prompt safety 👮‍♀️" });
    const llmCheck = await safePrompting(userPrompt)
    console.log(`The prompt is ${llmCheck}🧑‍⚖️`)
    if (llmCheck == "safe"){
      try{

        const llmSays = await generatePrompt(userPrompt);
        console.log(`LLM prompt 🤖-> ${llmSays}`);
    
        const CONFIG = await defineConfig(llmSays, randomNumber);
        const imageName = `'${CONFIG.imgName}'`
        console.log(`Image Name -> ${imageName}`)
        
        progressEmitter.emit('progress', { step: 2, message: `Creating your image ${imageName} 🎨` });
        const imageLocation = await imagine(llmSays, randomNumber);
        console.log(`Image successfully created 🎨`);
    
        console.log(`Uploading your Image🔼`);
        progressEmitter.emit('progress', { step: 3, message: 'Uploading your Image🔼' });
        const imageUri = await uploadImage(imageLocation, "");
    
        console.log(`Uploading the Metadata⏫`);
        progressEmitter.emit('progress', { step: 4, message: 'Uploading the Metadata⏫' });
        const metadataUri = await uploadMetadata(imageUri, CONFIG.imgType, CONFIG.imgName, CONFIG.description, CONFIG.attributes);
        console.log(`Metadata URI -> ${metadataUri}`);
    
        // Delete local image file
        fs.unlink(imageLocation, (err) => {
          if (err) {
            console.error('Failed to delete the local image file:', err);
          } else {
            console.log(`Local image file deleted successfully 🗑️`);
          }
        });
    
        console.log(`Minting your NFT🔨`);
        progressEmitter.emit('progress', { step: 5, message: 'Minting your NFT🔨' });
        const mintAddress = await mintProgrammableNft(metadataUri, CONFIG.imgName, CONFIG.sellerFeeBasisPoints, CONFIG.symbol, CONFIG.creators);
        if (!mintAddress) {
          throw new Error("Failed to mint the NFT. Mint address is undefined.");
        }
        
        console.log(`Transferring your NFT 📬`);
        progressEmitter.emit('progress', { step: 6, message: 'Transferring your NFT 📬' });
        const mintSend = await transferNFT(WALLET, userAddress, mintAddress.toString());
        console.log(mintSend)
    
        // Response
        res.json(mintSend);
    
      } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send({ error: "Error processing the request"});
      }
    } else {
      console.error('Unsafe prompt detected')
      res.status(500).send("Unsafe prompt detected");
    }
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

