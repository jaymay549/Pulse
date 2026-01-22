import * as React from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "type"
  > {
  value?: string | undefined;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: string; // Kept for API compatibility but ignored
}

// Format phone number as (XXX) XXX-XXXX
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");

  // Limit to 10 digits (US phone number)
  const limitedDigits = digits.slice(0, 10);

  // Format based on length
  if (limitedDigits.length === 0) return "";
  if (limitedDigits.length <= 3) return `(${limitedDigits}`;
  if (limitedDigits.length <= 6)
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
  return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(
    3,
    6
  )}-${limitedDigits.slice(6)}`;
};

// Convert formatted phone to E.164 format (+1XXXXXXXXXX)
const formatToE164 = (value: string): string | undefined => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return undefined;
};

// Convert E.164 format to display format
const formatFromE164 = (value: string | undefined): string => {
  if (!value) return "";
  // Remove +1 prefix if present
  const digits = value.replace(/^\+1/, "").replace(/\D/g, "");
  return formatPhoneNumber(digits);
};

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  (
    {
      className,
      value,
      onChange,
      id,
      name,
      placeholder = "(555) 123-4567",
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState(() =>
      formatFromE164(value)
    );

    // Update display value when external value changes
    React.useEffect(() => {
      setDisplayValue(formatFromE164(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const formatted = formatPhoneNumber(inputValue);
      setDisplayValue(formatted);

      // Convert to E.164 format for onChange callback
      const e164Value = formatToE164(formatted);
      onChange?.(e164Value);
    };

    const handleBlur = () => {
      // Ensure we have a valid phone number on blur
      const digits = displayValue.replace(/\D/g, "");
      if (digits.length === 10) {
        const formatted = formatPhoneNumber(digits);
        setDisplayValue(formatted);
        onChange?.(formatToE164(formatted));
      }
    };

    return (
      <input
        ref={ref}
        id={id}
        name={name || id || "tel"}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        maxLength={14} // (XXX) XXX-XXXX = 14 characters
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
export type { PhoneInputProps };
