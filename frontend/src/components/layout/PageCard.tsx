export const PageCard = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col gap-4 bg-linear-to-t from-primary-bg to-primary-bg-gradient-to rounded-3xl border border-neon-border overflow-hidden py-6">
      {children}
    </div>
  );
};
