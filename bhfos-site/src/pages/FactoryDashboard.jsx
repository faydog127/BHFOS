import React from 'react';

const FactoryDashboard = () => (
  <div className="p-10 text-white font-mono">
    <h1 className="text-2xl text-emerald-400 font-bold mb-4">BlackHorse Factory</h1>
    <p>Select a tool from the URL:</p>
    <ul className="list-disc ml-6 mt-2 space-y-2 text-slate-400">
      <li>/bhf/system-doctor</li>
      <li>/bhf/probe</li>
      <li>/bhf/build-health</li>
    </ul>
  </div>
);

export default FactoryDashboard;
