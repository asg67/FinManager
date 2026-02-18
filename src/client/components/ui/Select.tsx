import { type SelectHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, id, ...props }, ref) => {
    return (
      <div className={clsx("input-field", error && "input-field--error")}>
        {label && (
          <label htmlFor={id} className="input-field__label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={clsx("input-field__input input-field__select", className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <span className="input-field__error">{error}</span>}
      </div>
    );
  },
);

Select.displayName = "Select";
export default Select;
