import React from 'react';
import { motion } from 'framer-motion';
import { FiPlus } from 'react-icons/fi';

const FloatingActionButton = ({ onClick, className = '' }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`fixed bottom-6 right-6 z-40 w-14 h-14 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200 ${className}`}
      whileHover={{ 
        scale: 1.1,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
    >
      <motion.div
        whileHover={{ rotate: 45 }}
        transition={{ duration: 0.2 }}
      >
        <FiPlus className="w-6 h-6" />
      </motion.div>
    </motion.button>
  );
};

export default FloatingActionButton;