import axios from 'axios';
import * as readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to encode user inputs for URL
const encodeInput = (input: string): string => {
    return encodeURIComponent(input);
};

// Function to send request to the API
const sendRequest = async (prompt: string, address: string) => {
    const encodedPrompt = encodeInput(prompt);
    const encodedAddress = encodeInput(address);
    const url = `http://localhost:8800/imagine?user_prompt=${encodedPrompt}&address=${encodedAddress}`;

    try {
        const response = await axios.get(url);
        console.log('Response:', response.data);
    } catch (error) {
        if (error instanceof Error) {
            console.error('Error:', (error as any).response?.data || error.message);
        }
    }
};

// Prompt user for input
rl.question('Enter your prompt: ', (prompt) => {
    rl.question('Enter your address: ', (address) => {
        sendRequest(prompt, address).then(() => {
            rl.close();
        });
    });
});

// Test address: 2x4mEdCmozX4Lud87gvdkA9Luo2XWd9MWRX4mBMoG5MA
// If port errors out because already in use: lsof -i :8800 kill -9 <PID>
