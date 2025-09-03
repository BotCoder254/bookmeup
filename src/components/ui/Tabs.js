import React, { createContext, useContext, useState } from "react";

// Create context for tabs
const TabsContext = createContext({
  value: "",
  onValueChange: () => {},
});

const Tabs = ({ defaultValue, value, onValueChange, children, className = "" }) => {
  const [tabValue, setTabValue] = useState(defaultValue || "");

  // Allow controlled or uncontrolled usage
  const activeValue = value !== undefined ? value : tabValue;
  const handleValueChange = onValueChange || setTabValue;

  return (
    <TabsContext.Provider value={{ value: activeValue, onValueChange: handleValueChange }}>
      <div className={`tabs ${className}`}>{children}</div>
    </TabsContext.Provider>
  );
};

const TabsList = ({ children, className = "" }) => {
  return (
    <div className={`tabs-list ${className}`}>
      {children}
    </div>
  );
};

const TabsTrigger = ({ value, children, className = "", disabled = false }) => {
  const { value: activeValue, onValueChange } = useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => onValueChange(value)}
      className={`tabs-trigger ${isActive ? "tabs-trigger-active" : ""} ${className}`}
    >
      {children}
    </button>
  );
};

const TabsContent = ({ value, children, className = "" }) => {
  const { value: activeValue } = useContext(TabsContext);
  const isActive = activeValue === value;

  if (!isActive) return null;

  return (
    <div role="tabpanel" className={`tabs-content ${className}`}>
      {children}
    </div>
  );
};

export { Tabs, TabsList, TabsTrigger, TabsContent };
