import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-secondary-bg group-[.toaster]:text-primary-text group-[.toaster]:border-0 group-[.toaster]:shadow-lg group-[.toaster]:outline-none",
          description: "group-[.toast]:text-secondary-text",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-text group-[.toast]:border-0",
          cancelButton:
            "group-[.toast]:bg-secondary-bg group-[.toast]:text-secondary-text group-[.toast]:border-0",
          success: "group-[.toast]:bg-green-950 group-[.toast]:border-0 group-[.toast]:text-green-100 group-[.toast]:outline-none",
          error: "group-[.toast]:bg-purple-950 group-[.toast]:border-0 group-[.toast]:text-purple-100 group-[.toast]:outline-none",
          loading: "group-[.toast]:bg-secondary-bg group-[.toast]:border-0 group-[.toast]:text-primary-text group-[.toast]:outline-none",
          info: "group-[.toast]:bg-secondary-bg group-[.toast]:border-0 group-[.toast]:text-primary-text group-[.toast]:outline-none",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

