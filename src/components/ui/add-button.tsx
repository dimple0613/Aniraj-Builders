import * as React from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { Plus } from "lucide-react"

export interface AddButtonProps extends ButtonProps {
  children?: React.ReactNode
}

const AddButton = React.forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ children, ...props }, ref) => {
    return (
      <Button ref={ref} {...props}>
        <Plus className="h-4 w-4" />
        {children}
      </Button>
    )
  }
)
AddButton.displayName = "AddButton"

export { AddButton }
