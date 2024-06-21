import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import * as web3 from "@solana/web3.js";
import { PublicKey , SystemProgram } from '@solana/web3.js';

interface SubmitButtonProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
  userAddress: string;
  onTransactionSuccess: () => Promise<void>;
}

export const SubmitButton: FC<SubmitButtonProps> = ({ 
  isProcessing, 
  setIsProcessing, 
  userAddress,
  onTransactionSuccess,
}) => {
    const connection = new Connection(clusterApiUrl('devnet'));
    const wallet = useWallet();

    const onClick = async () => {
      console.log('User Address:', userAddress)
      if (!connection || !wallet || isProcessing) return;

      setIsProcessing(true);

      try {
        
        // Prepare Tx details
        const userAccount = new web3.PublicKey(userAddress);
        const pdaSeed = 'coloroffire';
        const program_pubKey = new web3.PublicKey("5y6nvZ2mHWG38oGN6jqUpg2mLFdsiWUBvJNDiQnHUBbS")
        const [treasuryAccount] = await web3.PublicKey.findProgramAddress(
          [Buffer.from(pdaSeed), userAccount.toBuffer()],
          program_pubKey
        );
        console.log('PDA Account:', treasuryAccount.toString());
  
        const instruction = web3.SystemProgram.transfer({        
          fromPubkey: userAccount,
          toPubkey: treasuryAccount,
          lamports: 50000000 
        });

        // Create a new transaction and add the instructions
        const transaction = new web3.Transaction();
        transaction.add(instruction);

        // Send the transaction
        const signature = await wallet.sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, 'finalized');
        console.log('Transaction signature:', signature);


        // Call the callback function on successful transaction
        await onTransactionSuccess();

      } catch (error) {
        console.error('Transaction error:', error);
        setIsProcessing(false);
      } finally {
        console.log('Transaction completed');
      }
    };
    return (
      <button
        type="button"
        disabled={isProcessing}
        onClick={onClick}
        className={`w-full py-2 px-4 ${isProcessing ? 'bg-blue-500' : 'bg-green-600 hover:bg-green-700'} text-white font-semibold rounded-md shadow-md focus:outline-none`}
      >
        {isProcessing ? 'Processing, this might take a few minutes...' : 'Submit'}
      </button>
    );
  };

export default SubmitButton;
