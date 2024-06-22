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

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!connection || !wallet || isProcessing) return;

    setIsProcessing(true);
    try {
      // You can add any necessary Solana transaction logic here if needed
      await onTransactionSuccess();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getButtonColor = () => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-purple-500'];
    return colors[currentStep] || colors[0];
  };

  return (
    <button
      type="submit"
      onClick={handleSubmit}
      disabled={isProcessing || !userAddress}
      className={`mt-4 w-full py-2 px-4 ${getButtonColor()} text-white font-bold rounded-md shadow-md ${
        isProcessing || !userAddress ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
      }`}
    >
      {isProcessing ? progressMessage : 'Submit'}
    </button>
  );
};

export default SubmitButton;