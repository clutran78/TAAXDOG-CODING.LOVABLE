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
  return (
    <div className="input-group">
      <input
        type="text"
        className="form-control"
        placeholder={placeholder || "Search..."}
        value={searchTerm}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default SearchBar;
