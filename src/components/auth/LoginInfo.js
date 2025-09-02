import React from 'react';
import { motion } from 'framer-motion';
import { FiInfo, FiUser, FiLock, FiCopy } from 'react-icons/fi';
import toast from 'react-hot-toast';

const LoginInfo = () => {
  const credentials = {
    username: 'admin',
    password: 'bookmarkvault123',
    email: 'admin@example.com'
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`);
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <FiInfo className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            Single-User Mode - Default Credentials
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded border px-3 py-2">
              <div className="flex items-center space-x-2">
                <FiUser className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Username:</span>
                <code className="font-mono text-gray-900 dark:text-white">{credentials.username}</code>
              </div>
              <button
                onClick={() => copyToClipboard(credentials.username, 'Username')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded border px-3 py-2">
              <div className="flex items-center space-x-2">
                <FiLock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-600 dark:text-gray-400">Password:</span>
                <code className="font-mono text-gray-900 dark:text-white">{credentials.password}</code>
              </div>
              <button
                onClick={() => copyToClipboard(credentials.password, 'Password')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiCopy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Please change the password after your first login for security.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default LoginInfo;