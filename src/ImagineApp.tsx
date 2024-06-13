import React, { useState, useEffect } from 'react';
import '@solana/wallet-adapter-react-ui/styles.css';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import SubmitButton from './SubmitButton';

interface TransferDetails {
    message: string;
    sender: string;
    receiver: string;
    transaction: string;
}

// interface ImagineAppProviderProps {
//   children: React.ReactNode;
// }

const wallets = [
  new PhantomWalletAdapter(),
];

const ImagineApp: React.FC = () => {
  const [userPrompt, setUserPrompt] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      setUserAddress(publicKey.toString());
    }
  }, [connected, publicKey]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => setUserPrompt(e.target.value);
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => setUserAddress(e.target.value);

  const handleTransactionSuccess = async () => {
    setIsProcessing(true);
    try {
      const cleanedAddress = userAddress.trim();
      console.log(cleanedAddress)
      const response = await fetch(`http://localhost:8800/imagine?user_prompt=${encodeURIComponent(userPrompt)}&address=${encodeURIComponent(cleanedAddress)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const res = await response.json();
      console.log('Response received:', res);
      setTransferDetails(res); 
    } 
    catch (err) {
      console.error('Error submitting form:', err);
      alert(`Failed to process the reques!`);
    }
    setIsProcessing(false);
  };
  
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-800 text-gray-100" 
       style={{ backgroundImage: 'url(/background.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute top-4 right-4">
        <WalletMultiButton />
      </div>
      <div className="max-w-md w-full bg-gray-900 p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">🌈Imagin' App🦄</h1>
        <form id="imagine-form" className="space-y-4" onSubmit={handleTransactionSuccess}>
          <div>
            <label htmlFor="user-prompt" className="block text-sm font-medium text-gray-300">Your Prompt</label>
            <input
              type="text"
              id="user-prompt"
              name="user-prompt"
              value={userPrompt}
              onChange={handlePromptChange}
              className="mt-1 p-2 block w-full bg-gray-700 text-gray-300 rounded-md border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50"
              required
            />
          </div>
          <div>
            <label htmlFor="user-address" className="block text-sm font-medium text-gray-300">Your Solana Address</label>
            <input
              type="text"
              id="user-address"
              name="user-address"
              value={userAddress}
              onChange={handleAddressChange}
              className="mt-1 p-2 block w-full bg-gray-700 text-gray-300 rounded-md border-gray-600 focus:border-indigo-500 focus:ring focus:ring-indigo-500 focus:ring-opacity-50"
              placeholder="Enter manually or connect your wallet"
              readOnly={!!connected && !!publicKey}
            />
          </div>
          <SubmitButton 
          isProcessing={isProcessing} 
          setIsProcessing={setIsProcessing} 
          userAddress={userAddress}
          onTransactionSuccess={handleTransactionSuccess}
          />
        </form>
        {transferDetails && ( 
          <div className="mt-4 text-sm">
            <p>{transferDetails.message}</p>
            <p><a href={transferDetails.receiver} target="_blank" rel="noopener noreferrer">Click here</a></p>
          </div>
        )}
      </div>
    </div>
  );
};

const AppWrapper: React.FC = () => {
  return (
    <ConnectionProvider endpoint={clusterApiUrl('mainnet-beta')}>
      <WalletProvider wallets={wallets}>
        <WalletModalProvider>
          <ImagineApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
export default AppWrapper;