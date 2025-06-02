import { useDarkMode } from "@/providers/dark-mode-provider";
import React from "react";

interface SearchBarProps {
  searchTerm: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onChange,
  placeholder,
}) => {
  const { darkMode } = useDarkMode();

  return (
    <div className="input-group">
      <input
        type="text"
        className={`form-control ${
          darkMode ? "bg-dark text-light" : "bg-light text-dark"
        }`}
        placeholder={placeholder || "Search..."}
        value={searchTerm}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
