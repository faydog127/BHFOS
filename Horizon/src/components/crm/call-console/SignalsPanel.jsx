import React from 'react';
import { motion } from 'framer-motion';
import { Rss, ExternalLink } from 'lucide-react';

const SeverityDot = ({ severity }) => {
  const getColor = () => {
    if (severity >= 16) return 'bg-red-500';
    if (severity >= 8) return 'bg-amber-500';
    return 'bg-gray-400';
  };
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${getColor()}`} />;
};

const SignalsPanel = ({ signals, isLoading }) => {
  if (isLoading) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">
        Acquiring signals...
      </div>
    );
  }

  if (!signals || signals.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">
        No signals found. Click "Acquire Intel" to search.
      </div>
    );
  }

  return (
    <div className="bg-gray-900/60 p-4 rounded-lg border border-gray-700 mt-4">
      <h3 className="font-bold text-gray-300 flex items-center mb-3 text-sm">
        <Rss className="h-4 w-4 mr-2 text-cyan-400" />
        RECENTLY ACQUIRED SIGNALS
      </h3>
      <ul className="space-y-3">
        {signals.map((signal, index) => (
          <motion.li
            key={signal.id || index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="text-sm"
          >
            <div className="flex items-start gap-3">
              <SeverityDot severity={signal.severity} />
              <div className="flex-1">
                <p className="text-gray-300 leading-snug">{signal.summary}</p>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  <span>{signal.signal_type}</span>
                  {signal.source_url && (
                    <a
                      href={signal.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                    >
                      {signal.source_domain}
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

export default SignalsPanel;