import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-secondary-bg group-[.toaster]:text-primary-text group-[.toaster]:border-0 group-[.toaster]:outline-none group-[.toaster]:min-w-[420px] group-[.toaster]:p-5 group-[.toaster]:text-base toast-with-shadow",
          description: "group-[.toast]:text-secondary-text group-[.toast]:text-base",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-text group-[.toast]:border-0 group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:text-base group-[.toast]:font-semibold",
          cancelButton:
            "group-[.toast]:bg-secondary-bg group-[.toast]:text-secondary-text group-[.toast]:border-0 group-[.toast]:px-4 group-[.toast]:py-2",
          success: "group-[.toast]:bg-green-950 group-[.toast]:border-2 group-[.toast]:border-green-600 group-[.toast]:text-green-100 group-[.toast]:outline-none group-[.toast]:text-base group-[.toast]:font-semibold toast-success-shadow",
          error: "group-[.toast]:bg-purple-950 group-[.toast]:border-2 group-[.toast]:border-purple-600 group-[.toast]:text-purple-100 group-[.toast]:outline-none group-[.toast]:text-base toast-error-shadow",
          loading: "group-[.toast]:bg-secondary-bg group-[.toast]:border-0 group-[.toast]:text-primary-text group-[.toast]:outline-none group-[.toast]:text-base toast-loading-shadow",
          info: "group-[.toast]:bg-secondary-bg group-[.toast]:border-0 group-[.toast]:text-primary-text group-[.toast]:outline-none group-[.toast]:text-base toast-info-shadow",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

