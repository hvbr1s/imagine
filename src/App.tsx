import React, { useState } from 'react';
import './App.css';
import './index.css';
import ImagineApp from './ImagineApp';

const App: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  console.log('App rendering');

  return (
    <ImagineApp />
  );
};

export default App;
