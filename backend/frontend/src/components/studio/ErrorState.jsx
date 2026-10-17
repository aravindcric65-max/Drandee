import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

const ErrorState = ({ error, onRetry, onBack }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bgMain">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center"
      >
        {/* Error Icon */}
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-error/20 flex items-center justify-center"
        >
          <AlertTriangle className="w-10 h-10 text-error" />
        </motion.div>

        {/* Title */}
        <h2 className="text-white font-bold text-2xl mb-4">
          Upload Failed
        </h2>

        <p className="text-textSecondary mb-8">
          {error || 'Something went wrong. Please try again.'}
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <motion.button
            onClick={onRetry}
            className="w-full py-4 bg-gradient-to-r from-primary to-secondary rounded-xl text-white font-bold flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </motion.button>

          <motion.button
            onClick={onBack}
            className="w-full py-4 bg-bgCard rounded-xl text-white font-medium flex items-center justify-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ErrorState;