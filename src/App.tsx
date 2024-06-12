import React, { useState } from 'react';
import './App.css';
import './index.css';
import ImagineAppProvider from './ImagineApp';
import SubmitButton from './SubmitButton';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  console.log('App rendering');

  return (
    <ImagineAppProvider>
      <div className="App">
        <header className="App-header">
          <h1 className="text-3xl font-bold">Imagine App</h1>
          <SubmitButton isProcessing={isProcessing} setIsProcessing={setIsProcessing} />
        </header>
      </div>
    </ImagineAppProvider>
  );
};

export default App;
