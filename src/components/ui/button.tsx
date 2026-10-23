import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[14px] border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform,box-shadow] duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-peach-deep/40 active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default: "bg-peach text-ink-strong hover:bg-[#e29c7e] shadow-[0_1px_0_rgb(139_111_94/0.08)]",
        outline: "border-line-strong bg-surface-raised text-ink hover:bg-ivory hover:border-[#d9bfae]",
        secondary: "bg-sand/70 text-ink-strong hover:bg-sand",
        ghost: "text-ink hover:bg-ivory-deep",
        destructive: "bg-missed-bg text-missed hover:bg-[#f4d3ce]",
        link: "text-peach-deep underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4 text-[15px]",
        sm: "h-9 gap-1.5 rounded-[12px] px-3 text-sm",
        xs: "h-7 gap-1 rounded-[10px] px-2.5 text-xs",
        lg: "h-13 gap-2 rounded-[16px] px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-9 rounded-[12px]",
        "icon-xs": "size-7 rounded-[10px]",
        "icon-lg": "size-13 rounded-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
