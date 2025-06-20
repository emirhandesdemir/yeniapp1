
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        xs: "h-8 rounded-md px-2 text-xs",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  smSize?: VariantProps<typeof buttonVariants>["size"]
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, smSize, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const [effectiveSize, setEffectiveSize] = React.useState(size);

    React.useEffect(() => {
      const updateSize = () => {
        if (typeof window !== 'undefined') {
           // 640px (Tailwind's sm breakpoint) altındaysa smSize kullan, yoksa normal size
           setEffectiveSize(window.innerWidth < 640 && smSize ? smSize : size);
        } else {
           setEffectiveSize(size); // SSR veya tarayıcı dışı ortamlar için fallback
        }
      };
      updateSize(); // İlk renderda boyutu ayarla
      window.addEventListener('resize', updateSize); // Ekran boyutu değiştikçe güncelle
      return () => window.removeEventListener('resize', updateSize); // Cleanup
    }, [size, smSize]);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size: effectiveSize, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
