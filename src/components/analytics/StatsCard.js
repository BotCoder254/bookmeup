import React from "react";
import { motion } from "framer-motion";

const colors = {
  blue: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    icon: "text-blue-500 dark:text-blue-400",
    border: "border-blue-100 dark:border-blue-900/50",
  },
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
    icon: "text-green-500 dark:text-green-400",
    border: "border-green-100 dark:border-green-900/50",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-600 dark:text-yellow-400",
    icon: "text-yellow-500 dark:text-yellow-400",
    border: "border-yellow-100 dark:border-yellow-900/50",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
    text: "text-indigo-600 dark:text-indigo-400",
    icon: "text-indigo-500 dark:text-indigo-400",
    border: "border-indigo-100 dark:border-indigo-900/50",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-600 dark:text-red-400",
    icon: "text-red-500 dark:text-red-400",
    border: "border-red-100 dark:border-red-900/50",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-900/20",
    text: "text-purple-600 dark:text-purple-400",
    icon: "text-purple-500 dark:text-purple-400",
    border: "border-purple-100 dark:border-purple-900/50",
  },
};

const StatsCard = ({
  title,
  value,
  subtitle,
  icon,
  color = "blue",
  className = "",
}) => {
  const colorClasses = colors[color] || colors.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg shadow-sm ${colorClasses.bg} ${colorClasses.border} border p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
          <p className={`text-2xl font-bold mt-1 ${colorClasses.text}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-2 rounded-full ${colorClasses.bg} ${colorClasses.icon}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export default StatsCard;
