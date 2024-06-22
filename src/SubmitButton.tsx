import * as web3 from "@solana/web3.js";
import React, { useState, useEffect, FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, clusterApiUrl } from '@solana/web3.js';

interface SubmitButtonProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  userAddress: string;
  onTransactionSuccess: () => Promise<void>;
}

const SubmitButton: FC<SubmitButtonProps> = ({ 
  isProcessing, 
  setIsProcessing, 
  userAddress,
  onTransactionSuccess 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const connection = new Connection(clusterApiUrl('devnet'));
  const wallet = useWallet();

  useEffect(() => {
    if (isProcessing) {
      const eventSource = new EventSource('http://localhost:8800/progress');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setCurrentStep(data.step);
        setProgressMessage(data.message);
      };

      return () => {
        eventSource.close();
      };
    }
  }, [isProcessing]);

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!connection || !wallet || isTransactionPending || isProcessing) return;

    setIsTransactionPending(true);
    setProgressMessage('Sending transaction...');

    try {
      const userAccount = new web3.PublicKey(userAddress);
      const pdaSeed = 'coloroffire';
      const program_pubKey = new web3.PublicKey("5y6nvZ2mHWG38oGN6jqUpg2mLFdsiWUBvJNDiQnHUBbS")
      const [treasuryAccount] = await web3.PublicKey.findProgramAddress(
        [Buffer.from(pdaSeed)],
        program_pubKey
      );
      console.log(`Treasury account is ${treasuryAccount}`)

      const instruction = web3.SystemProgram.transfer({        
        fromPubkey: userAccount,
        toPubkey: treasuryAccount,
        lamports: 50000000 
      });

      const transaction = new web3.Transaction().add(instruction);

      const signature = await wallet.sendTransaction(transaction, connection);
      console.log('Transaction sent:', signature);
      setProgressMessage('Transaction sent, waiting for confirmation...');

      await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed:', signature);

      setIsTransactionPending(false);
      setIsProcessing(true);
      await onTransactionSuccess();

    } catch (error) {
      console.error('Error:', error);
      setProgressMessage('Transaction failed. Please try again.');
      setIsTransactionPending(false);
    }
  };

  const getButtonColor = () => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500'];
    return colors[currentStep] || colors[0];
  };

  const isButtonDisabled = isTransactionPending || isProcessing || !userAddress;

  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={isButtonDisabled}
      className={`mt-4 w-full py-2 px-4 ${getButtonColor()} text-white font-bold rounded-md shadow-md ${
        isButtonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
      }`}
    >
      {isTransactionPending || isProcessing ? progressMessage : 'Submit'}
    </button>
  );
};

export default SubmitButton;