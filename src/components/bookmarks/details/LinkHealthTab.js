import React, { useState, useEffect } from "react";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiRotateCw,
  FiLink,
  FiRefreshCw,
  FiExternalLink,
  FiClipboard,
} from "react-icons/fi";
import { formatDateTime, apiClient } from "../../../utils/api";
import { useToast } from "../../../contexts";

const LinkHealthTab = ({ bookmark }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Define fetchHealthData function
  const fetchHealthData = async () => {
    if (!bookmark?.id) return;

    try {
      setLoading(true);

      // Get the bookmark data which includes health_status
      const response = await apiClient.getBookmark(bookmark.id);

      if (response && response.health_status) {
        // Format health data from the bookmark response
        setHealthData({
          id: response.id, // Include ID for applyRedirect
          status: response.health_status.status || "pending",
          last_checked: response.health_status.last_checked,
          final_url: response.health_status.final_url,
          archive_url: response.health_status.archive_url,
          // Add placeholder values for other fields if needed
          status_code: response.health_status.status_code,
          response_time: response.health_status.response_time,
          error_message: response.health_status.error_message,
        });
      } else {
        setHealthData(null);
      }
    } catch (error) {
      console.error("Error fetching health data:", error);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  // Run fetchHealthData on component mount and when bookmark changes
  useEffect(() => {
    if (bookmark?.id) {
      fetchHealthData();
    }
  }, [bookmark?.id]);

  const runHealthCheck = async () => {
    if (!bookmark?.id) return;

    setIsChecking(true);
    try {
      // Use the direct endpoint
      const response = await apiClient.request(
        `/bookmarks/${bookmark.id}/check-health/`,
        {
          method: "POST",
        },
      );

      showToast({
        type: "success",
        title: "Success",
        message: "Link health check completed",
      });

      // Get the updated bookmark with fresh health data from the response
      if (response && response.bookmark && response.bookmark.health_status) {
        setHealthData({
          id: response.bookmark.id, // Add ID for apply_redirect to work
          status: response.bookmark.health_status.status || "pending",
          last_checked: response.bookmark.health_status.last_checked,
          final_url: response.bookmark.health_status.final_url,
          archive_url: response.bookmark.health_status.archive_url,
          status_code: response.bookmark.health_status.status_code,
          response_time: response.bookmark.health_status.response_time,
          error_message: response.bookmark.health_status.error_message,
        });
      } else {
        // Fallback to regular fetch if response doesn't contain health data
        await fetchHealthData();
      }
    } catch (error) {
      console.error("Error checking link health:", error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to check link health",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const applyRedirect = async () => {
    if (!healthData || !healthData.id) {
      console.error("Health data missing ID:", healthData);
      showToast({
        type: "error",
        title: "Error",
        message: "Missing health record information",
      });
      return;
    }

    try {
      await apiClient.applyRedirect(healthData.id);

      showToast({
        type: "success",
        title: "Success",
        message: "Bookmark URL updated to final redirect location",
      });

      // Refresh health data and bookmark data
      await fetchHealthData();
    } catch (error) {
      console.error("Error applying redirect:", error);
      showToast({
        type: "error",
        title: "Error",
        message: "Failed to apply redirect",
      });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => {
        showToast({
          type: "success",
          title: "Copied",
          message: "URL copied to clipboard",
        });
      },
      (err) => {
        console.error("Could not copy text: ", err);
      },
    );
  };

  const getStatusBadge = (status) => {
    let icon = <FiLink className="w-4 h-4" />;
    let label = "Unknown";
    let colorClass =
      "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";

    switch (status) {
      case "ok":
        icon = <FiCheckCircle className="w-4 h-4" />;
        label = "Healthy";
        colorClass =
          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
        break;
      case "redirected":
        icon = <FiRotateCw className="w-4 h-4" />;
        label = "Redirected";
        colorClass =
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
        break;
      case "broken":
        icon = <FiAlertCircle className="w-4 h-4" />;
        label = "Broken";
        colorClass =
          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
        break;
      case "pending":
        icon = <FiRefreshCw className="w-4 h-4" />;
        label = "Pending Check";
        colorClass =
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
        break;
      case "archived":
        icon = <FiLink className="w-4 h-4" />;
        label = "Archived";
        colorClass =
          "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
        break;
      default:
        break;
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {icon}
        <span className="ml-1">{label}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Link Health
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Check if your bookmark link is still valid and working properly.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between">
        <button
          onClick={runHealthCheck}
          disabled={isChecking}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
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
      </div>

      {loading ? (
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          Loading health information...
        </div>
      ) : !healthData ? (
        <div className="py-4 text-center text-gray-500 dark:text-gray-400">
          No health information available. Run a health check to analyze this
          link.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                Link Status
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Last checked:{" "}
                {healthData.last_checked
                  ? formatDateTime(healthData.last_checked)
                  : "Never"}
              </p>
            </div>
            <div>{getStatusBadge(healthData.status)}</div>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Original URL
                </dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-white group flex items-center">
                  <div className="truncate">{bookmark.url}</div>
                  <button
                    onClick={() => copyToClipboard(bookmark.url)}
                    className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100"
                    title="Copy URL"
                  >
                    <FiClipboard className="w-4 h-4" />
                  </button>
                </dd>
              </div>

              {healthData.final_url &&
                healthData.final_url !== bookmark.url && (
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Final URL (after redirects)
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 dark:text-white group flex items-center">
                      <div className="truncate">{healthData.final_url}</div>
                      <button
                        onClick={() => copyToClipboard(healthData.final_url)}
                        className="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100"
                        title="Copy URL"
                      >
                        <FiClipboard className="w-4 h-4" />
                      </button>
                      <a
                        href={healthData.final_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100"
                        title="Open URL"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </a>
                    </dd>
                  </div>
                )}

              {healthData.status_code && (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Status Code
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {healthData.status_code}
                  </dd>
                </div>
              )}

              {healthData.response_time && (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Response Time
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    {healthData.response_time}ms
                  </dd>
                </div>
              )}

              {healthData.error_message && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Error Message
                  </dt>
                  <dd className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {healthData.error_message}
                  </dd>
                </div>
              )}

              {healthData.archive_url && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Web Archive
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-white">
                    <a
                      href={healthData.archive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center"
                    >
                      <FiExternalLink className="w-4 h-4 mr-1" />
                      View archived version
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            {healthData.status === "redirected" && (
              <div className="mt-6 flex">
                <button
                  onClick={applyRedirect}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  <FiRotateCw className="-ml-1 mr-2 h-4 w-4" />
                  Update to final URL
                </button>
              </div>
            )}

            {healthData.status === "broken" && !healthData.archive_url && (
              <div className="mt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This link appears to be broken. Consider replacing it with a
                  working URL or finding an archived version.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkHealthTab;
