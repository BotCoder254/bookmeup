import React, { useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiRotateCw, FiLink, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';
import { getToken } from '../../utils/auth';

const LinkHealthChecker = ({ bookmarkId, onCheckComplete }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState(null);

  const runHealthCheck = async () => {
    setIsChecking(true);
    try {
      const token = getToken();
      await axios.post(
        `/api/bookmarks/${bookmarkId}/check-health/`,
        {},
        {
          headers: {
            Authorization: `Token ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      // Get updated health status
      const response = await axios.get(`/api/link-health/?bookmark=${bookmarkId}`, {
        headers: {
          Authorization: `Token ${token}`
        }
      });

      const healthData = response.data.results && response.data.results.length > 0
        ? response.data.results[0]
        : null;

      setLastCheckResult(healthData);

      if (onCheckComplete) {
        onCheckComplete(healthData);
      }
    } catch (error) {
      console.error('Error checking link health:', error);
      setLastCheckResult({ error: true, message: 'Failed to check link health' });
    } finally {
      setIsChecking(false);
    }
  };

  const getHealthStatusIcon = (status) => {
    switch (status) {
      case 'ok':
        return <FiCheckCircle className="w-4 h-4 text-green-500" />;
      case 'redirected':
        return <FiRotateCw className="w-4 h-4 text-yellow-500" />;
      case 'broken':
        return <FiAlertCircle className="w-4 h-4 text-red-500" />;
      case 'archived':
        return <FiLink className="w-4 h-4 text-blue-500" />;
      default:
        return <FiLink className="w-4 h-4" />;
    }
  };

  const getHealthStatusLabel = (status) => {
    switch (status) {
      case 'ok':
        return 'Link is healthy';
      case 'redirected':
        return 'Link is redirected';
      case 'broken':
        return 'Link is broken';
      case 'archived':
        return 'Archive available';
      case 'pending':
        return 'Pending check';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className="flex flex-col space-y-3">
      <button
        onClick={runHealthCheck}
        disabled={isChecking}
        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-800"
      >
        {isChecking ? (
          <>
            <FiRefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
            Checking...
          </>
        ) : (
          <>
            <FiRefreshCw className="-ml-1 mr-2 h-4 w-4" />
            Check Link Health
          </>
        )}
      </button>

      {lastCheckResult && !lastCheckResult.error && (
        <div className="mt-2 flex items-center text-sm">
          {getHealthStatusIcon(lastCheckResult.status)}
          <span className="ml-2">{getHealthStatusLabel(lastCheckResult.status)}</span>

          {lastCheckResult.status === 'redirected' && (
            <button
              onClick={async () => {
                try {
                  const token = getToken();
                  await axios.post(
                    `/api/link-health/${lastCheckResult.id}/apply-redirect/`,
                    {},
                    {
                      headers: {
                        Authorization: `Token ${token}`,
                        'Content-Type': 'application/json',
                      }
                    }
                  );

                  if (onCheckComplete) {
                    onCheckComplete({...lastCheckResult, status: 'ok'});
                  }

                  setLastCheckResult({...lastCheckResult, status: 'ok'});
                } catch (error) {
                  console.error('Error applying redirect:', error);
                }
              }}
              className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Apply redirect
            </button>
          )}

          {lastCheckResult.has_archive && lastCheckResult.archive_url && (
            <a
              href={lastCheckResult.archive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View archived version
            </a>
          )}
        </div>
      )}

      {lastCheckResult && lastCheckResult.error && (
        <div className="mt-2 text-red-500 text-sm">
          {lastCheckResult.message}
        </div>
      )}
    </div>
  );
};

export default LinkHealthChecker;
