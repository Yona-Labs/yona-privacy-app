import { FC, ReactNode } from "react";
import { Link, useMatch } from "react-router";
import { twMerge } from "tailwind-merge";

interface NavLinkProps {
  to: string;
  name: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

export const NavLink: FC<NavLinkProps> = ({ to, name, icon: Icon }) => {
  const isSelected = useMatch(to);

  return (
    <li>
      <Link
        to={to}
        className={twMerge(
          "font-semibold p-2 flex items-center gap-2 transition-colors",
          "text-secondary-text hover:text-primary active:text-primary/70",
          isSelected && "text-primary"
        )}
      >
        {Icon && <Icon className="w-5 h-5 transition-colors duration-200" />}
        {name}
      </Link>
    </li>
  );
};
