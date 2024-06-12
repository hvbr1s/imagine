import { FC } from 'react';
import * as fs from 'graceful-fs';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from './public/pda_account.json';

interface SubmitButtonProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
}

export const SubmitButton: FC<SubmitButtonProps> = ({ isProcessing, setIsProcessing }) => {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();

  const onClick = async () => {
    if (!connection || !anchorWallet || isProcessing) return;

    setIsProcessing(true);

    try {
      const provider = new anchor.AnchorProvider(connection, anchorWallet, anchor.AnchorProvider.defaultOptions());
      const program = new anchor.Program(idl as anchor.Idl, provider);

      const [pdaAccount, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from(process.env.PDA_SEED!), anchorWallet.publicKey.toBuffer()],
        program.programId
      );

      const treasuryPublicKey = new PublicKey('ARTpmCQfGQ7W5gN9dHkSXPErCzoBWSp8qAshKuZetosE');

      await (program.methods as any)
        .initializeDepositWithdraw()
        .accounts({
          user: anchorWallet.publicKey,
          pdaAccount: pdaAccount,
          treasury: treasuryPublicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log('Transaction completed successfully');
    } catch (error) {
      console.error('Transaction error:', error);
    } finally {
      setIsProcessing(false);
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