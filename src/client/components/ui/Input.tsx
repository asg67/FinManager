import { type InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className={clsx("input-field", error && "input-field--error")}>
        {label && (
          <label htmlFor={id} className="input-field__label">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={clsx("input-field__input", className)}
          {...props}
        />
        {error && <span className="input-field__error">{error}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";
export default Input;
