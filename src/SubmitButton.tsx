import { FC } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import * as web3 from "@solana/web3.js";

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
    const pdaSeed = "coloroffire";

    const onClick = async () => {
      console.log('User Address:', userAddress)
      if (!connection || !wallet || isProcessing) return;

      setIsProcessing(true);

      try {
        const userPublicKey = new web3.PublicKey(userAddress);
        const [pdaAccount] = await web3.PublicKey.findProgramAddress(
          [Buffer.from(pdaSeed), userPublicKey.toBuffer()],
          new web3.PublicKey("DpTtSJ135oXPpWjUuRsLq6chZC2Qytf9Bsmk6oZUWvrb")
        );
        console.log('PDA Account:', pdaAccount.toString());
        const treasuryPublicKey = new web3.PublicKey('ARTpmCQfGQ7W5gN9dHkSXPErCzoBWSp8qAshKuZetosE');
        const systemProgramId = web3.SystemProgram.programId;

        // Create a new transaction
        const transaction = new web3.Transaction();
        // const instruction = new web3.TransactionInstruction({
        //   keys: [
        //     { pubkey: userPublicKey, isSigner: true, isWritable: true },
        //     { pubkey: pdaAccount, isSigner: false, isWritable: true },
        //     { pubkey: treasuryPublicKey, isSigner: false, isWritable: true },
        //     { pubkey: systemProgramId, isSigner: false, isWritable: false }
        //   ],
        //   programId: new web3.PublicKey("DpTtSJ135oXPpWjUuRsLq6chZC2Qytf9Bsmk6oZUWvrb")
        // });

        const instruction = web3.SystemProgram.transfer({        
          fromPubkey: userPublicKey,
          toPubkey: pdaAccount,
          lamports: 5000000 // Deposit 0.05 SOL in lamports
        });

        // Add the instruction to the transaction
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
        {isProcessing ? 'Processing...' : 'Submit'}
      </button>
    );
  };

export default SubmitButton;