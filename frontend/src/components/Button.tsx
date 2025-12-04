import { ButtonHTMLAttributes, DetailedHTMLProps, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  isLoading?: boolean;
  loadingInfo?: ReactNode;
}

export const Button = ({
  children,
  isLoading = false,
  loadingInfo = "Loading...",
  className,
  ...props
}: ButtonProps) => {
  return (
    <button
      type="button"
      className={twMerge(
        "h-15 px-6 bg-linear-to-r from-primary-button-bg to-primary-button-bg-gradient-to hover:bg-primary-button-bg-gradient-to active:bg-primary-button-bg-gradient-to disabled:from-disabled disabled:to-disabled disabled:text-disabled-text text-lg font-semibold cursor-pointer rounded-xl duration-150",
        className
      )}
      disabled={isLoading}
      {...props}
    >
      {isLoading && (
        <Loader2 className="inline-block mr-3 h-4 w-4 animate-spin" />
      )}
      {isLoading && (
        <span className="inline-block align-middle">{loadingInfo}</span>
      )}
      {!isLoading && (
        <span className="inline-block align-middle">{children}</span>
      )}
    </button>
  );
};
