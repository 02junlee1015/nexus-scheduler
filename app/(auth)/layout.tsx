export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
